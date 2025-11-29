import 'dotenv/config';
import { Telegraf, Context, Markup } from 'telegraf';
import * as http from 'http';
import { loggingMiddleware } from './middleware/logging';
import {
    registerCreateRoom,
    registerInvite,
    registerJoin,
    registerRoom,
    registerMyRooms,
    registerDeleteRoom,
    registerAddBuyIn,
    registerRemoveBuyIn,
    registerSummary,
    registerCashOut,
    registerSettle,
    registerSetWallet
} from './commands';
import { getRoom, getPlayer, updatePlayerJoined, registerUser, deleteRoom as deleteRoomFunc } from './db';
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
    return ctx.reply(
        `welcome to straddle fun ♠️\n\n` +
        `here are some quick actions to help you get started\n\n` +
        `shuffle up and deal - your next hand is waiting🃏`,
        {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🎯 Create Room', 'create_room_now')],
                [Markup.button.callback('💳 Setup Wallet', 'setup_wallet_help')],
                [Markup.button.callback('📖 View Commands', 'show_help')]
            ])
        }
    );
});

// /help command
const helpMessage =
    `straddle commands\n\n` +
    `rooms\n\n` +
    `/createroom – create a new poker room\n` +
    `/invite – invite a player to a room\n` +
    `/joinroom – join an existing room\n` +
    `/room – view active room info: players, buy-ins, stacks, cashouts\n` +
    `/myrooms – view your previous rooms\n\n` +
    `buy-ins & tracking\n\n` +
    `/addbuyin – add a buy-in to a player's stack (admin only)\n` +
    `/removebuyin – remove a buy-in from a player's stack (admin only)\n` +
    `/cashout – record a player's final chips (admin only)\n\n` +
    `settlement & payments\n\n` +
    `/settle – calculate final balances and generate payout links\n\n` +
    `wallet\n\n` +
    `/setwallet – set your solana or base wallet to receive payouts\n\n` +
    `general\n\n` +
    `/help – show all commands\n` +
    `/ping – check bot response time`;

bot.command('help', (ctx) => {
    return ctx.reply(helpMessage);
});


// /ping command
bot.command('ping', async (ctx) => {
    const start = Date.now();
    const sent = await ctx.reply('🏓 Pinging...');
    const latency = Date.now() - start;
    const response =
        `🏓 *Pong!*\n\n` +
        `⚡ *Latency:* ${formatLatency(latency)}\n` +
        `✅ *Status:* Online\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🎯 All systems operational!`;

    try {
        await ctx.telegram.editMessageText(
            ctx.chat!.id,
            sent.message_id,
            undefined,
            response,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📖 View Commands', 'show_help')],
                    [Markup.button.callback('🎯 Create Room', 'create_room_now')]
                ])
            }
        );
    } catch {
        // fallback if edit fails (private chats or permissions)
        await ctx.reply(response, { parse_mode: 'Markdown' });
    }
});

// callback query handlers for inline buttons
bot.action('show_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(helpMessage);
});

bot.action('create_room_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `🎯 *Creating a Room*\n\n` +
        `1️⃣ Use \`/createroom\` to start\n` +
        `2️⃣ Get your room ID\n` +
        `3️⃣ Invite players with \`/invite <roomId> @username\`\n` +
        `4️⃣ Players can join with the invite link\n\n` +
        `Ready to create your first room?`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Back', 'show_start')]
            ])
        }
    );
});

bot.action('setup_wallet_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `💳 *Setting Up Your Wallet*\n\n` +
        `1️⃣ Install Phantom wallet\n` +
        `2️⃣ Copy your wallet address\n` +
        `3️⃣ Use \`/setwallet <your_address>\`\n\n` +
        `Your wallet will receive settlement payments automatically!`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Back', 'show_start')]
            ])
        }
    );
});

bot.action('show_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `welcome to straddle fun ♠️\n\n` +
        `here are some quick actions to help you get started\n\n` +
        `shuffle up and deal - your next hand is waiting🃏`,
        {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🎯 Create Room', 'create_room_now')],
                [Markup.button.callback('💳 Setup Wallet', 'setup_wallet_help')],
                [Markup.button.callback('📖 View Commands', 'show_help')]
            ])
        }
    );
});

// Shared callback handlers
bot.action(/confirm_delete_(.+)/, async (ctx) => {
    const roomId = ctx.match[1];
    const userId = ctx.from!.id;

    await ctx.answerCbQuery();

    const room = await getRoom(roomId);
    if (!room || room.ownerId !== userId) {
        return ctx.editMessageText(
            `❌ *Error*\n\n` +
            `Room not found or you don't have permission to delete it.`,
            { parse_mode: 'Markdown' }
        );
    }

    const success = await deleteRoomFunc(roomId);

    if (success) {
        await ctx.editMessageText(
            `✅ *Room Deleted Successfully*\n\n` +
            `🎯 *Room ID:* \`${roomId}\`\n\n` +
            `The room and all associated data have been permanently deleted.\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💡 Create a new room anytime with \`/createroom\``,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📋 My Rooms', 'view_myrooms')],
                    [Markup.button.callback('➕ Create New Room', 'create_room_now')]
                ])
            }
        );
    } else {
        await ctx.editMessageText(
            `❌ *Delete Failed*\n\n` +
            `Failed to delete room \`${roomId}\`.\n\n` +
            `Please try again later.`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.action('cancel_delete', async (ctx) => {
    await ctx.answerCbQuery('Delete cancelled');
    await ctx.editMessageText(
        `✅ *Deletion Cancelled*\n\n` +
        `Your room was not deleted.`,
        { parse_mode: 'Markdown' }
    );
});

bot.action('view_myrooms', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        `Use \`/myrooms\` to see all your rooms!`,
        { parse_mode: 'Markdown' }
    );
});

// register room commands
registerCreateRoom(bot);
registerInvite(bot);
registerJoin(bot);
registerRoom(bot);
registerMyRooms(bot);
registerDeleteRoom(bot);

// register buy-in commands
registerAddBuyIn(bot);
registerRemoveBuyIn(bot);
registerSummary(bot);

// register settlement commands
registerCashOut(bot);
registerSettle(bot);

// register wallet command
registerSetWallet(bot);

// Set bot commands (appears in menu button)
bot.telegram.setMyCommands([
    { command: 'start', description: '🎯 Start the bot' },
    { command: 'help', description: '📖 Show all commands' },
    { command: 'createroom', description: '🎯 Create a new game room' },
    { command: 'myrooms', description: '🏠 View your rooms' },
    { command: 'invite', description: '👥 Invite a player' },
    { command: 'joinroom', description: '✅ Join a room' },
    { command: 'room', description: '📊 View room details' },
    { command: 'addbuyin', description: '💰 Add buy-in (admin)' },
    { command: 'removebuyin', description: '💸 Remove buy-in (admin)' },
    { command: 'cashout', description: '🎰 Record cashout (admin)' },
    { command: 'summary', description: '📊 View summary' },
    { command: 'settle', description: '💸 Settle payments (admin)' },
    { command: 'setwallet', description: '💳 Setup wallet' },
    { command: 'ping', description: '🏓 Check bot status' }
]).catch(err => console.error('Failed to set commands:', err));

// Set bot description
bot.telegram.setMyDescription('create poker rooms, manage buy-ins, track stacks, and settle everything onchain using solana or base (usdc) - keep gambling.')
    .catch(err => console.error('Failed to set description:', err));

// global error handler
bot.catch((err, ctx) => {
    console.error(`global error for update ${ctx.updateType}`, err);
});

// create http server for health checks
const PORT = parseInt(process.env.PORT || '3333', 10);
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: 'running' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    }
});

// start http server first, then bot
(async () => {
    // start http server immediately so Render can detect the port
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`http server listening on port ${PORT}`);
    });

    // then launch bot
    try {
        await bot.launch();
        console.log('bot started (polling). press ctrl-c to stop.');
    } catch (err) {
        console.error('failed to launch bot:', err);
        console.error('http server will continue running for health checks');
        // don't exit - keep http server running for Render health checks
    }

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
})();
