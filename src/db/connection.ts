import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'stac.db');
export const db = new Database(dbPath);

// enable foreign keys
db.pragma('foreign_keys = ON');

// initialize schema
db.exec(`
    -- rooms table
    CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        owner_id INTEGER NOT NULL,
        owner_username TEXT NOT NULL,
        settled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- players table
    CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id INTEGER NOT NULL DEFAULT 0,
        username TEXT NOT NULL,
        buy_in REAL NOT NULL DEFAULT 0,
        cash_out REAL NOT NULL DEFAULT 0,
        joined INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        UNIQUE(room_id, username)
    );

    -- buy-in history table
    CREATE TABLE IF NOT EXISTS buyin_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        player_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    -- indexes for performance
    CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
    CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
    CREATE INDEX IF NOT EXISTS idx_history_player ON buyin_history(player_id);
`);

// migrate: add new columns if they don't exist
try {
    db.exec(`ALTER TABLE rooms ADD COLUMN settled INTEGER NOT NULL DEFAULT 0`);
} catch (e) {
    // column already exists
}

try {
    db.exec(`ALTER TABLE players ADD COLUMN cash_out REAL NOT NULL DEFAULT 0`);
} catch (e) {
    // column already exists
}

console.log('database initialized:', dbPath);
