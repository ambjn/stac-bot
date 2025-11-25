-- Users table migration for STAC Bot
-- Run this in your Supabase SQL Editor after the main migration

-- Users table to track everyone who has used /start
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy (Allow all operations for now - adjust based on your security needs)
CREATE POLICY "Enable all operations for users" ON users
    FOR ALL USING (true) WITH CHECK (true);
