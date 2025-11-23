export interface Player {
    username: string;
    buyIn: number;
}

export interface Room {
    id: string;
    ownerId: number;
    players: Player[];
}
