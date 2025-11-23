export interface Player {
    userId: number;
    username: string;
    buyIn: number;
    joined: boolean;
}

export interface Room {
    id: string;
    ownerId: number;
    ownerUsername: string;
    players: Player[];
    createdAt: Date;
}
