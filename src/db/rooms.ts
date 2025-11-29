import { supabase } from './connection';
import { Room, Player, BuyInEntry, Settlement, PlayerPnL, RoomSettlement } from '../state/types';
import { cache } from '../utils/cache';

// room operations
export const createRoom = async (room: Omit<Room, 'players' | 'createdAt' | 'settled'>): Promise<Room> => {
    const { data, error } = await supabase
        .from('rooms')
        .insert({
            id: room.id,
            owner_id: room.ownerId,
            owner_username: room.ownerUsername,
            settled: false
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create room: ${error.message}`);

    return {
        ...room,
        players: [],
        createdAt: new Date(data.created_at),
        settled: false
    };
};

export const getRoom = async (roomId: string, useCache: boolean = true): Promise<Room | null> => {
    const cacheKey = `room:${roomId}`;

    // check cache first
    if (useCache) {
        const cached = cache.get<Room>(cacheKey);
        if (cached) return cached;
    }

    const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

    if (roomError || !roomData) return null;

    const players = await getPlayers(roomId);

    const room: Room = {
        id: roomData.id,
        ownerId: roomData.owner_id,
        ownerUsername: roomData.owner_username,
        players,
        createdAt: new Date(roomData.created_at),
        settled: roomData.settled
    };

    // cache for 10 seconds
    cache.set(cacheKey, room, 10000);

    return room;
};

export const deleteRoom = async (roomId: string): Promise<boolean> => {
    const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

    // invalidate cache
    cache.delete(`room:${roomId}`);

    return !error;
};

export const setRoomSettled = async (roomId: string, settled: boolean): Promise<void> => {
    await supabase
        .from('rooms')
        .update({ settled })
        .eq('id', roomId);

    // invalidate cache
    cache.delete(`room:${roomId}`);
};

export const getRoomsByUser = async (userId: number, username: string): Promise<{ id: string; role: string }[]> => {
    const rooms: { id: string; role: string }[] = [];

    // rooms owned by user
    const { data: ownedRooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('owner_id', userId);

    if (ownedRooms) {
        ownedRooms.forEach((r: any) => rooms.push({ id: r.id, role: '👑 owner' }));
    }

    // rooms user is a player in
    const { data: playingRooms } = await supabase
        .from('players')
        .select('room_id')
        .or(`user_id.eq.${userId},username.eq.${username}`)
        .eq('joined', true);

    if (playingRooms) {
        playingRooms.forEach((r: any) => {
            if (!rooms.some(x => x.id === r.room_id)) {
                rooms.push({ id: r.room_id, role: '👤 player' });
            }
        });
    }

    return rooms;
};

// Get the active room for an owner (prioritizes rooms with players/buyins that aren't settled)
export const getActiveRoomForOwner = async (userId: number): Promise<string | null> => {
    const cacheKey = `active_room:${userId}`;

    // check cache first (5 second TTL for active room)
    const cached = cache.get<string>(cacheKey);
    if (cached) return cached;

    // get all rooms owned by user with player and buy-in data in one query
    const { data: ownedRooms } = await supabase
        .from('rooms')
        .select(`
            id,
            settled,
            created_at
        `)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

    if (!ownedRooms || ownedRooms.length === 0) {
        return null;
    }

    // get player counts and buy-in totals for all rooms in one query
    const roomIds = ownedRooms.map(r => r.id);
    const { data: playerStats } = await supabase
        .from('players')
        .select('room_id, buy_in')
        .in('room_id', roomIds);

    // build stats map
    const statsMap = new Map<string, { playerCount: number; totalBuyIn: number }>();
    if (playerStats) {
        for (const p of playerStats) {
            const existing = statsMap.get(p.room_id) || { playerCount: 0, totalBuyIn: 0 };
            existing.playerCount++;
            existing.totalBuyIn += p.buy_in || 0;
            statsMap.set(p.room_id, existing);
        }
    }

    let activeRoomId: string | null = null;

    // prioritize: unsettled rooms with players and buy-ins
    for (const roomData of ownedRooms) {
        if (roomData.settled) continue;
        const stats = statsMap.get(roomData.id);
        if (stats && stats.playerCount > 0 && stats.totalBuyIn > 0) {
            activeRoomId = roomData.id;
            break;
        }
    }

    // fallback: unsettled rooms with players (even without buy-ins)
    if (!activeRoomId) {
        for (const roomData of ownedRooms) {
            if (roomData.settled) continue;
            const stats = statsMap.get(roomData.id);
            if (stats && stats.playerCount > 0) {
                activeRoomId = roomData.id;
                break;
            }
        }
    }

    // fallback: any unsettled room
    if (!activeRoomId) {
        for (const roomData of ownedRooms) {
            if (!roomData.settled) {
                activeRoomId = roomData.id;
                break;
            }
        }
    }

    // last resort: most recent room (even if settled)
    if (!activeRoomId) {
        activeRoomId = ownedRooms[0].id;
    }

    // cache for 5 seconds
    if (activeRoomId) {
        cache.set(cacheKey, activeRoomId, 5000);
    }

    return activeRoomId;
};

// player operations
export const addPlayer = async (roomId: string, player: Omit<Player, 'history' | 'cashOut'>): Promise<void> => {
    await supabase
        .from('players')
        .insert({
            room_id: roomId,
            user_id: player.userId,
            username: player.username,
            buy_in: player.buyIn,
            cash_out: 0,
            joined: player.joined
        });
};

export const getPlayer = async (roomId: string, userId: number, username: string): Promise<Player | null> => {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .or(`user_id.eq.${userId},username.eq.${username}`)
        .limit(1)
        .single();

    if (error || !data) return null;

    const history = await getPlayerHistory(data.id);

    return {
        userId: data.user_id,
        username: data.username,
        buyIn: data.buy_in,
        cashOut: data.cash_out,
        joined: data.joined,
        history
    };
};

export const getPlayerByUsername = async (roomId: string, username: string): Promise<Player | null> => {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('username', username)
        .single();

    if (error || !data) return null;

    const history = await getPlayerHistory(data.id);

    return {
        userId: data.user_id,
        username: data.username,
        buyIn: data.buy_in,
        cashOut: data.cash_out,
        joined: data.joined,
        history
    };
};

export const getPlayers = async (roomId: string): Promise<Player[]> => {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('buy_in', { ascending: false });

    if (error || !data) return [];

    // get all player IDs
    const playerIds = data.map((row: any) => row.id);

    // fetch all histories in one query
    const { data: allHistories } = await supabase
        .from('buyin_history')
        .select('*')
        .in('player_id', playerIds)
        .order('timestamp', { ascending: false });

    // group histories by player_id
    const historyMap = new Map<number, BuyInEntry[]>();
    if (allHistories) {
        for (const h of allHistories) {
            if (!historyMap.has(h.player_id)) {
                historyMap.set(h.player_id, []);
            }
            historyMap.get(h.player_id)!.push({
                amount: h.amount,
                action: h.action as 'add' | 'remove',
                timestamp: new Date(h.timestamp)
            });
        }
    }

    // build players with their histories
    const players = data.map((row: any) => ({
        userId: row.user_id,
        username: row.username,
        buyIn: row.buy_in,
        cashOut: row.cash_out,
        joined: row.joined,
        history: historyMap.get(row.id) || []
    }));

    return players;
};

export const updatePlayerJoined = async (roomId: string, username: string, userId: number): Promise<void> => {
    await supabase
        .from('players')
        .update({ joined: true, user_id: userId })
        .eq('room_id', roomId)
        .eq('username', username);

    // invalidate room cache
    cache.delete(`room:${roomId}`);
};

export const updatePlayerBuyIn = async (
    roomId: string,
    userId: number,
    username: string,
    amount: number,
    action: 'add' | 'remove'
): Promise<{ success: boolean; newTotal: number; error?: string }> => {
    // get or create player record
    let { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .or(`user_id.eq.${userId},username.eq.${username}`)
        .single();

    if (playerError || !playerData) {
        // create player entry for owner
        const { data: newPlayer, error: insertError } = await supabase
            .from('players')
            .insert({
                room_id: roomId,
                user_id: userId,
                username: username,
                buy_in: 0,
                cash_out: 0,
                joined: true
            })
            .select()
            .single();

        if (insertError || !newPlayer) {
            return { success: false, newTotal: 0, error: 'failed to create player' };
        }

        playerData = newPlayer;
    }

    const currentBuyIn = playerData.buy_in;
    let newTotal: number;

    if (action === 'add') {
        newTotal = currentBuyIn + amount;
    } else {
        if (currentBuyIn < amount) {
            return { success: false, newTotal: currentBuyIn, error: 'insufficient buy-in' };
        }
        newTotal = currentBuyIn - amount;
    }

    // update buy-in
    await supabase
        .from('players')
        .update({ buy_in: newTotal })
        .eq('id', playerData.id);

    // log history
    await supabase
        .from('buyin_history')
        .insert({
            room_id: roomId,
            player_id: playerData.id,
            amount,
            action
        });

    // invalidate caches
    cache.delete(`room:${roomId}`);
    cache.delete(`active_room:${userId}`);

    return { success: true, newTotal };
};

// cashout operations
export const updatePlayerCashOut = async (
    roomId: string,
    userId: number,
    username: string,
    amount: number
): Promise<{ success: boolean; error?: string }> => {
    const { data: playerData, error } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomId)
        .or(`user_id.eq.${userId},username.eq.${username}`)
        .single();

    if (error || !playerData) {
        return { success: false, error: 'player not found' };
    }

    await supabase
        .from('players')
        .update({ cash_out: amount })
        .eq('id', playerData.id);

    // invalidate room cache
    cache.delete(`room:${roomId}`);

    return { success: true };
};

// settlement calculations
export const calculateSettlement = async (roomId: string): Promise<RoomSettlement | null> => {
    const room = await getRoom(roomId);
    if (!room) return null;

    const activePlayers = room.players.filter(p => p.joined || p.buyIn > 0);

    // calculate totals
    const totalBuyIn = activePlayers.reduce((sum, p) => sum + p.buyIn, 0);
    const totalCashOut = activePlayers.reduce((sum, p) => sum + p.cashOut, 0);
    const mismatch = totalCashOut - totalBuyIn;

    // calculate P&L for each player
    const playersPnL: PlayerPnL[] = activePlayers.map(p => ({
        username: p.username,
        buyIn: p.buyIn,
        cashOut: p.cashOut,
        pnl: p.cashOut - p.buyIn
    })).sort((a, b) => b.pnl - a.pnl); // sort by profit descending

    // calculate settlements (who owes whom)
    const settlements = calculateOptimalSettlements(playersPnL);

    return {
        roomId,
        totalBuyIn,
        totalCashOut,
        mismatch,
        players: playersPnL,
        settlements
    };
};

// optimal settlement algorithm - minimizes number of transactions
const calculateOptimalSettlements = (players: PlayerPnL[]): Settlement[] => {
    const settlements: Settlement[] = [];

    // separate winners and losers
    const winners = players.filter(p => p.pnl > 0).map(p => ({ ...p }));
    const losers = players.filter(p => p.pnl < 0).map(p => ({ ...p, pnl: Math.abs(p.pnl) }));

    // sort winners by profit desc, losers by loss desc
    winners.sort((a, b) => b.pnl - a.pnl);
    losers.sort((a, b) => b.pnl - a.pnl);

    // match losers to winners
    let i = 0, j = 0;
    while (i < losers.length && j < winners.length) {
        const loser = losers[i];
        const winner = winners[j];

        const amount = Math.min(loser.pnl, winner.pnl);

        if (amount > 0) {
            settlements.push({
                from: loser.username,
                to: winner.username,
                amount: Math.round(amount * 100) / 100 // round to 2 decimals
            });
        }

        loser.pnl -= amount;
        winner.pnl -= amount;

        if (loser.pnl <= 0.01) i++; // small tolerance for floating point
        if (winner.pnl <= 0.01) j++;
    }

    return settlements;
};

// history operations
export const getPlayerHistory = async (playerId: number): Promise<BuyInEntry[]> => {
    const { data, error } = await supabase
        .from('buyin_history')
        .select('*')
        .eq('player_id', playerId)
        .order('timestamp', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
        amount: row.amount,
        action: row.action as 'add' | 'remove',
        timestamp: new Date(row.timestamp)
    }));
};
