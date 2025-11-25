import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import * as http from 'http';
import { loggingMiddleware } from './middleware/logging';
import {
    registerCreateRoom,
    registerInvite,
    registerJoin,
    registerRoom,
    registerMyRooms,
    registerAddBuyIn,
    registerRemoveBuyIn,
    registerSummary,
    registerCashOut,
    registerSettle
} from './commands';
import { getRoom, getPlayer, updatePlayerJoined, registerUser } from './db';
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
bot.start(async (ctx) => {
    const name = ctx.from?.first_name ?? 'there';
    const payload = ctx.payload; // e.g. "join_abc123"

    // Register or update user in database
    if (ctx.from) {
        try {
            await registerUser(
                ctx.from.id,
                ctx.from.username,
                ctx.from.first_name,
                ctx.from.last_name
            );
        } catch (err) {
            console.error('Failed to register user:', err);
            // Continue execution even if user registration fails
        }
    }

    // handle join deep link
    if (payload?.startsWith('join_')) {
        const roomId = payload.replace('join_', '');
        const room = await getRoom(roomId);

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
        const player = await getPlayer(roomId, userId, username);

        if (!player) {
            return ctx.reply(`❌ you were not invited to room ${roomId}.`);
        }

        if (player.joined) {
            return ctx.reply(`ℹ️ you already joined room ${roomId}.\n\nuse /room ${roomId} to view details.`);
        }

        // mark as joined
        await updatePlayerJoined(roomId, player.username, userId);

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
        `/summary <roomId> - view room summary\n\n` +
        `🏆 settlement:\n` +
        `/cashout <roomId> <amount> - record final chips\n` +
        `/settle <roomId> - calculate p&l and settlements`
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

// register settlement commands
registerCashOut(bot);
registerSettle(bot);

// global error handler
bot.catch((err, ctx) => {
    console.error(`global error for update ${ctx.updateType}`, err);
});

// create http server for health checks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: 'running' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    }
});

// start polling and http server
(async () => {
    try {
        await bot.launch();
        console.log('bot started (polling). press ctrl-c to stop.');

        server.listen(PORT, () => {
            console.log(`http server listening on port ${PORT}`);
        });

        // graceful stop
        const shutdown = () => {
            console.log('shutting down...');
            bot.stop('SIGTERM');
            server.close(() => {
                console.log('http server closed');
                process.exit(0);
            });
        };

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    } catch (err) {
        console.error('failed to launch bot:', err);
        process.exit(1);
    }
})();
