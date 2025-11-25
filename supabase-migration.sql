-- Supabase Migration for STAC Bot
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    owner_username TEXT NOT NULL,
    settled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL DEFAULT 0,
    username TEXT NOT NULL,
    buy_in DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cash_out DECIMAL(10, 2) NOT NULL DEFAULT 0,
    joined BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(room_id, username)
);

-- Buy-in history table
CREATE TABLE IF NOT EXISTS buyin_history (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_history_player ON buyin_history(player_id);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyin_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all operations for now - adjust based on your security needs)
-- For rooms
CREATE POLICY "Enable all operations for rooms" ON rooms
    FOR ALL USING (true) WITH CHECK (true);

-- For players
CREATE POLICY "Enable all operations for players" ON players
    FOR ALL USING (true) WITH CHECK (true);

-- For buyin_history
CREATE POLICY "Enable all operations for buyin_history" ON buyin_history
    FOR ALL USING (true) WITH CHECK (true);
