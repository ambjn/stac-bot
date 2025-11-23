export type BuyInAction = 'add' | 'remove';

export interface BuyInEntry {
    amount: number;
    action: BuyInAction;
    timestamp: Date;
}

export interface Player {
    userId: number;
    username: string;
    buyIn: number;
    cashOut: number;
    joined: boolean;
    history: BuyInEntry[];
}

export interface Room {
    id: string;
    ownerId: number;
    ownerUsername: string;
    players: Player[];
    createdAt: Date;
    settled: boolean;
}

export interface Settlement {
    from: string;
    to: string;
    amount: number;
}

export interface PlayerPnL {
    username: string;
    buyIn: number;
    cashOut: number;
    pnl: number; // profit/loss (cashOut - buyIn)
}

export interface RoomSettlement {
    roomId: string;
    totalBuyIn: number;
    totalCashOut: number;
    mismatch: number;
    players: PlayerPnL[];
    settlements: Settlement[];
}
