import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import { loggingMiddleware } from './middleware/logging';
import {
    registerCreateRoom,
    registerInvite,
    registerJoin,
    registerRoom,
    registerMyRooms,
    registerAddBuyIn,
    registerRemoveBuyIn,
    registerSummary
} from './commands';
import { getRoom, getPlayer, updatePlayerJoined } from './db';
import { formatLatency } from './utils/format';

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('error: bot_token not set in .env');
    process.exit(1);
}

const bot = new Telegraf<Context>(token);

// middleware
bot.use(loggingMiddleware);

// /start command (handles deep links)
bot.start((ctx) => {
    const name = ctx.from?.first_name ?? 'there';
    const payload = ctx.payload; // e.g. "join_abc123"

    // handle join deep link
    if (payload?.startsWith('join_')) {
        const roomId = payload.replace('join_', '');
        const room = getRoom(roomId);

        if (!room) {
            return ctx.reply(`❌ room not found.\n\nhey ${name}👋 i'm stac🎯\ntype /help to see commands.`);
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is the owner
        if (room.ownerId === userId) {
            return ctx.reply(`👑 you are the owner of room ${roomId}!\n\nuse /room ${roomId} to view details.`);
        }

        // check if user was invited
        const player = getPlayer(roomId, userId, username);

        if (!player) {
            return ctx.reply(`❌ you were not invited to room ${roomId}.`);
        }

        if (player.joined) {
            return ctx.reply(`ℹ️ you already joined room ${roomId}.\n\nuse /room ${roomId} to view details.`);
        }

        // mark as joined
        updatePlayerJoined(roomId, player.username, userId);

        return ctx.reply(
            `✅ welcome ${name}! you joined room ${roomId}\n\n` +
            `use /room ${roomId} to see room details.`
        );
    }

    // default start message
    return ctx.reply(`hey ${name}👋 i'm stac🎯\nyour smart settlement tool🪚\n\ntype /help to see commands.`);
});

// /help command
bot.command('help', (ctx) => {
    return ctx.reply(
        `i understand these commands:\n\n` +
        `📋 general:\n` +
        `/start - start the bot\n` +
        `/help - show help\n` +
        `/ping - check latency\n\n` +
        `🎯 rooms:\n` +
        `/createroom - create a new room\n` +
        `/invite <roomId> @username - invite player\n` +
        `/join <roomId> - join a room you're invited to\n` +
        `/room <roomId> - view room details\n` +
        `/myrooms - list your rooms\n\n` +
        `💰 buy-ins:\n` +
        `/addbuyin <roomId> <amount> - add buy-in\n` +
        `/removebuyin <roomId> <amount> - remove buy-in\n` +
        `/summary <roomId> - view room summary`
    );
});

// /ping command
bot.command('ping', async (ctx) => {
    const start = Date.now();
    const sent = await ctx.reply('pinging…');
    const latency = Date.now() - start;
    const response = `pong! ${formatLatency(latency)}`;

    try {
        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sent.message_id,
            undefined,
            response
        );
    } catch {
        // fallback if edit fails (private chats or permissions)
        await ctx.reply(response);
    }
});

// register room commands
registerCreateRoom(bot);
registerInvite(bot);
registerJoin(bot);
registerRoom(bot);
registerMyRooms(bot);

// register buy-in commands
registerAddBuyIn(bot);
registerRemoveBuyIn(bot);
registerSummary(bot);

// global error handler
bot.catch((err, ctx) => {
    console.error(`global error for update ${ctx.updateType}`, err);
});

// start polling
(async () => {
    try {
        await bot.launch();
        console.log('bot started (polling). press ctrl-c to stop.');

        // graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (err) {
        console.error('failed to launch bot:', err);
        process.exit(1);
    }
})();
