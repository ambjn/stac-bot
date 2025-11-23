import { db } from './connection';
import { Room, Player, BuyInEntry, Settlement, PlayerPnL, RoomSettlement } from '../state/types';

// room operations
export const createRoom = (room: Omit<Room, 'players' | 'createdAt' | 'settled'>): Room => {
    const stmt = db.prepare(`
        INSERT INTO rooms (id, owner_id, owner_username)
        VALUES (?, ?, ?)
    `);
    stmt.run(room.id, room.ownerId, room.ownerUsername);

    return {
        ...room,
        players: [],
        createdAt: new Date(),
        settled: false
    };
};

export const getRoom = (roomId: string): Room | null => {
    const roomRow = db.prepare(`
        SELECT id, owner_id, owner_username, settled, created_at
        FROM rooms WHERE id = ?
    `).get(roomId) as any;

    if (!roomRow) return null;

    const players = getPlayers(roomId);

    return {
        id: roomRow.id,
        ownerId: roomRow.owner_id,
        ownerUsername: roomRow.owner_username,
        players,
        createdAt: new Date(roomRow.created_at),
        settled: roomRow.settled === 1
    };
};

export const deleteRoom = (roomId: string): boolean => {
    const result = db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
    return result.changes > 0;
};

export const setRoomSettled = (roomId: string, settled: boolean): void => {
    db.prepare('UPDATE rooms SET settled = ? WHERE id = ?').run(settled ? 1 : 0, roomId);
};

export const getRoomsByUser = (userId: number, username: string): { id: string; role: string }[] => {
    const rooms: { id: string; role: string }[] = [];

    // rooms owned by user
    const owned = db.prepare(`
        SELECT id FROM rooms WHERE owner_id = ?
    `).all(userId) as any[];
    owned.forEach(r => rooms.push({ id: r.id, role: '👑 owner' }));

    // rooms user is a player in
    const playing = db.prepare(`
        SELECT DISTINCT room_id FROM players
        WHERE (user_id = ? OR username = ?) AND joined = 1
    `).all(userId, username) as any[];
    playing.forEach(r => {
        if (!rooms.some(x => x.id === r.room_id)) {
            rooms.push({ id: r.room_id, role: '👤 player' });
        }
    });

    return rooms;
};

// player operations
export const addPlayer = (roomId: string, player: Omit<Player, 'history' | 'cashOut'>): void => {
    const stmt = db.prepare(`
        INSERT INTO players (room_id, user_id, username, buy_in, cash_out, joined)
        VALUES (?, ?, ?, ?, 0, ?)
    `);
    stmt.run(roomId, player.userId, player.username, player.buyIn, player.joined ? 1 : 0);
};

export const getPlayer = (roomId: string, userId: number, username: string): Player | null => {
    const row = db.prepare(`
        SELECT id, user_id, username, buy_in, cash_out, joined
        FROM players
        WHERE room_id = ? AND (user_id = ? OR username = ?)
        LIMIT 1
    `).get(roomId, userId, username) as any;

    if (!row) return null;

    const history = getPlayerHistory(row.id);

    return {
        userId: row.user_id,
        username: row.username,
        buyIn: row.buy_in,
        cashOut: row.cash_out,
        joined: row.joined === 1,
        history
    };
};

export const getPlayerByUsername = (roomId: string, username: string): Player | null => {
    const row = db.prepare(`
        SELECT id, user_id, username, buy_in, cash_out, joined
        FROM players
        WHERE room_id = ? AND username = ?
    `).get(roomId, username) as any;

    if (!row) return null;

    const history = getPlayerHistory(row.id);

    return {
        userId: row.user_id,
        username: row.username,
        buyIn: row.buy_in,
        cashOut: row.cash_out,
        joined: row.joined === 1,
        history
    };
};

export const getPlayers = (roomId: string): Player[] => {
    const rows = db.prepare(`
        SELECT id, user_id, username, buy_in, cash_out, joined
        FROM players WHERE room_id = ?
        ORDER BY buy_in DESC
    `).all(roomId) as any[];

    return rows.map(row => ({
        userId: row.user_id,
        username: row.username,
        buyIn: row.buy_in,
        cashOut: row.cash_out,
        joined: row.joined === 1,
        history: getPlayerHistory(row.id)
    }));
};

export const updatePlayerJoined = (roomId: string, username: string, userId: number): void => {
    db.prepare(`
        UPDATE players SET joined = 1, user_id = ?
        WHERE room_id = ? AND username = ?
    `).run(userId, roomId, username);
};

export const updatePlayerBuyIn = (
    roomId: string,
    userId: number,
    username: string,
    amount: number,
    action: 'add' | 'remove'
): { success: boolean; newTotal: number; error?: string } => {
    // get or create player record
    let playerRow = db.prepare(`
        SELECT id, buy_in FROM players
        WHERE room_id = ? AND (user_id = ? OR username = ?)
    `).get(roomId, userId, username) as any;

    if (!playerRow) {
        // create player entry for owner
        db.prepare(`
            INSERT INTO players (room_id, user_id, username, buy_in, cash_out, joined)
            VALUES (?, ?, ?, 0, 0, 1)
        `).run(roomId, userId, username);

        playerRow = db.prepare(`
            SELECT id, buy_in FROM players WHERE room_id = ? AND user_id = ?
        `).get(roomId, userId) as any;
    }

    const currentBuyIn = playerRow.buy_in;
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
    db.prepare(`UPDATE players SET buy_in = ? WHERE id = ?`).run(newTotal, playerRow.id);

    // log history
    db.prepare(`
        INSERT INTO buyin_history (room_id, player_id, amount, action)
        VALUES (?, ?, ?, ?)
    `).run(roomId, playerRow.id, amount, action);

    return { success: true, newTotal };
};

// cashout operations
export const updatePlayerCashOut = (
    roomId: string,
    userId: number,
    username: string,
    amount: number
): { success: boolean; error?: string } => {
    const playerRow = db.prepare(`
        SELECT id FROM players
        WHERE room_id = ? AND (user_id = ? OR username = ?)
    `).get(roomId, userId, username) as any;

    if (!playerRow) {
        return { success: false, error: 'player not found' };
    }

    db.prepare(`UPDATE players SET cash_out = ? WHERE id = ?`).run(amount, playerRow.id);
    return { success: true };
};

// settlement calculations
export const calculateSettlement = (roomId: string): RoomSettlement | null => {
    const room = getRoom(roomId);
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
export const getPlayerHistory = (playerId: number): BuyInEntry[] => {
    const rows = db.prepare(`
        SELECT amount, action, timestamp
        FROM buyin_history WHERE player_id = ?
        ORDER BY timestamp DESC
    `).all(playerId) as any[];

    return rows.map(row => ({
        amount: row.amount,
        action: row.action as 'add' | 'remove',
        timestamp: new Date(row.timestamp)
    }));
};
