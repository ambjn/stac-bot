# STAC Bot - Supabase Migration

This bot has been migrated from SQLite to Supabase for better scalability and cloud-based data management.

## 🔄 Migration Changes

### What Changed
- **Database**: SQLite → Supabase (PostgreSQL)
- **Dependencies**: Removed `better-sqlite3`, added `@supabase/supabase-js`
- **All database operations**: Now async/await
- **Environment variables**: New Supabase configuration required

### Files Modified
- `package.json` - Updated dependencies
- `src/db/connection.ts` - New Supabase client initialization
- `src/db/rooms.ts` - Complete rewrite using Supabase queries
- All command files - Updated to use async/await

## 🚀 Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be provisioned

### 2. Run the Database Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Open the file `supabase-migration.sql` from this repository
3. Copy and paste the entire SQL script into the SQL Editor
4. Click **Run** to create all tables, indexes, and policies

### 3. Get Your Supabase Credentials

1. In your Supabase project, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Bot

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## 📊 Database Schema

The bot uses three main tables:

### `rooms`
- `id` (TEXT) - Room identifier
- `owner_id` (BIGINT) - Telegram user ID of owner
- `owner_username` (TEXT) - Owner's username
- `settled` (BOOLEAN) - Whether room is settled
- `created_at` (TIMESTAMPTZ) - Creation timestamp

### `players`
- `id` (BIGSERIAL) - Auto-incrementing ID
- `room_id` (TEXT) - Foreign key to rooms
- `user_id` (BIGINT) - Telegram user ID
- `username` (TEXT) - Player username
- `buy_in` (DECIMAL) - Total buy-in amount
- `cash_out` (DECIMAL) - Cash out amount
- `joined` (BOOLEAN) - Whether player has joined

### `buyin_history`
- `id` (BIGSERIAL) - Auto-incrementing ID
- `room_id` (TEXT) - Foreign key to rooms
- `player_id` (BIGINT) - Foreign key to players
- `amount` (DECIMAL) - Transaction amount
- `action` (TEXT) - 'add' or 'remove'
- `timestamp` (TIMESTAMPTZ) - Transaction timestamp

## 🔐 Security Notes

- Row Level Security (RLS) is enabled on all tables
- Current policies allow all operations (adjust based on your needs)
- The `anon` key is safe to use in client applications
- Never commit your `.env` file to version control

## 🆘 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
Run `npm install` to install dependencies.

### "Missing Supabase environment variables"
Make sure your `.env` file contains `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### Database connection errors
- Verify your Supabase project is active
- Check that your credentials are correct
- Ensure the migration SQL has been run

### Data migration from SQLite
If you have existing data in SQLite:
1. Export data from your SQLite database
2. Use Supabase's data import tools or write a migration script
3. Contact support if you need help with data migration

## 📝 Development Notes

All database operations are now asynchronous. When adding new features:
- Use `async/await` for all database calls
- Handle errors appropriately
- Test with your Supabase instance

## 🤝 Support

For issues or questions:
- Check the Supabase documentation: https://supabase.com/docs
- Review the bot commands in `src/commands/`
- Open an issue in the repository
