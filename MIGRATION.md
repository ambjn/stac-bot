# Quick Migration Guide: SQLite to Supabase

## Summary of Changes

### ✅ Completed Tasks

1. **Removed SQLite Dependencies**
   - Removed `better-sqlite3` and `@types/better-sqlite3`
   - Added `@supabase/supabase-js`

2. **Updated Database Layer**
   - `src/db/connection.ts` - Now initializes Supabase client
   - `src/db/rooms.ts` - All functions converted to async/await with Supabase queries
   - All database operations now return Promises

3. **Updated All Command Handlers**
   - `src/commands/createRoom.ts` - async/await
   - `src/commands/invite.ts` - async/await
   - `src/commands/join.ts` - async/await
   - `src/commands/room.ts` - async/await
   - `src/commands/myrooms.ts` - async/await
   - `src/commands/addbuyin.ts` - async/await
   - `src/commands/removebuyin.ts` - async/await
   - `src/commands/cashout.ts` - async/await
   - `src/commands/settle.ts` - async/await
   - `src/commands/summary.ts` - async/await

4. **Updated Bot Entry Point**
   - `src/bot.ts` - Start command handler now async

5. **Created Migration Files**
   - `supabase-migration.sql` - Database schema for Supabase
   - `.env.example` - Template for environment variables
   - `README.md` - Complete setup and migration documentation

## Next Steps

### 1. Set Up Supabase (5 minutes)

1. Create account at https://supabase.com
2. Create a new project
3. Run the SQL migration from `supabase-migration.sql`
4. Copy your project URL and anon key

### 2. Configure Environment (1 minute)

```bash
cp .env.example .env
# Edit .env with your credentials
```

Add these values to `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Install and Run (2 minutes)

```bash
npm install
npm run build
npm start
```

## Database Schema Comparison

### SQLite (Old)
- Local file: `stac.db`
- Synchronous operations
- Single-server only

### Supabase (New)
- Cloud PostgreSQL database
- Asynchronous operations
- Scalable, distributed
- Built-in authentication & RLS
- Real-time capabilities (future use)

## Key Differences in Code

### Before (SQLite)
```typescript
const room = getRoom(roomId);
if (!room) {
    return ctx.reply('Room not found');
}
```

### After (Supabase)
```typescript
const room = await getRoom(roomId);
if (!room) {
    return ctx.reply('Room not found');
}
```

All database functions now:
- Return `Promise<T>` instead of `T`
- Must be called with `await`
- Must be in an `async` function

## Testing Checklist

After migration, test these commands:

- [ ] `/start` - Bot starts correctly
- [ ] `/createroom` - Creates a room
- [ ] `/invite <roomId> @username` - Invites a player
- [ ] `/join <roomId>` - Player joins room
- [ ] `/room <roomId>` - Shows room details
- [ ] `/myrooms` - Lists user's rooms
- [ ] `/addbuyin <roomId> <amount>` - Adds buy-in
- [ ] `/removebuyin <roomId> <amount>` - Removes buy-in
- [ ] `/cashout <roomId> <amount>` - Records cashout
- [ ] `/summary <roomId>` - Shows summary
- [ ] `/settle <roomId>` - Calculates settlement

## Rollback Plan

If you need to rollback to SQLite:

1. Checkout the previous commit: `git checkout HEAD~1`
2. Run `npm install`
3. Your old `stac.db` file should still be there

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Check `README.md` for detailed setup instructions
