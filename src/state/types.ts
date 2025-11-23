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
    joined: boolean;
    history: BuyInEntry[];
}

export interface Room {
    id: string;
    ownerId: number;
    ownerUsername: string;
    players: Player[];
    createdAt: Date;
}

export interface RoomSummary {
    roomId: string;
    owner: string;
    totalPlayers: number;
    totalBuyIn: number;
    players: {
        username: string;
        buyIn: number;
        percentage: number;
    }[];
}
