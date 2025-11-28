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
    registerAddBuyIn,
    registerRemoveBuyIn,
    registerSummary,
    registerCashOut,
    registerSettle,
    registerStacPay,
    registerSetWallet,
    registerTestPay
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
    return ctx.reply(
        `welcome to straddle fun ♠️\n\n` +
        `here are some commands to help you get started:\n\n` +
        `• /createroom – start a new poker room\n` +
        `• /joinroom – join an existing room\n` +
        `• /addbuyin – add a buy-in to a player's stack (admin only)\n` +
        `• /removebuyin – remove a player's buy-in (admin only)\n` +
        `• /room <roomId> – view active and past room info, players, buy-ins, and cashouts\n` +
        `• /myrooms – see your previous rooms\n` +
        `• /setwallet <address> – set your solana or base wallet to receive payouts\n\n` +
        `shuffle up and deal - your next hand is waiting🃏`,
        {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📖 View Commands', 'show_help')],
                [Markup.button.callback('🎯 Create Room', 'create_room_now')],
                [Markup.button.callback('💳 Setup Wallet', 'setup_wallet_help')]
            ])
        }
    );
});

// /help command
const helpMessage =
    `straddle commands\n\n` +
    `rooms\n\n` +
    `/createroom – create a new poker room\n` +
    `/invite <roomId> @username – invite a player to a room\n` +
    `/joinroom <roomId> – join an existing room\n` +
    `/room <roomId> – view active room info: players, buy-ins, stacks, cashouts\n` +
    `/myrooms – view your previous rooms\n\n` +
    `buy-ins & tracking\n\n` +
    `/addbuyin <roomId> <amount> – add a buy-in to a player's stack (admin only)\n` +
    `/removebuyin <roomId> <amount> – remove a buy-in from a player's stack (admin only)\n` +
    `/cashout <roomId> <amount> – record a player's final chips\n\n` +
    `settlement & payments\n\n` +
    `/settle <roomId> – calculate final balances and generate payout links\n\n` +
    `wallet\n\n` +
    `/setwallet <address> – set your solana or base wallet to receive payouts\n\n` +
    `general\n\n` +
    `/help – show all commands\n` +
    `/ping – check bot response time`;

bot.command('help', (ctx) => {
    return ctx.reply(helpMessage, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🎯 Create Room', 'create_room_now')],
            [Markup.button.callback('🏠 My Rooms', 'my_rooms_help')],
            [Markup.button.callback('💳 Setup Wallet', 'setup_wallet_help')]
        ])
    });
});

// Help callback handlers
bot.action('my_rooms_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        `🏠 *My Rooms*\n\n` +
        `Use: \`/myrooms\`\n\n` +
        `This shows all rooms you own or have joined!`,
        { parse_mode: 'Markdown' }
    );
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
    const name = ctx.from?.first_name ?? 'there';
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `welcome to straddle fun ♠️\n\n` +
        `here are some commands to help you get started:\n\n` +
        `• /createroom – start a new poker room\n` +
        `• /joinroom – join an existing room\n` +
        `• /addbuyin – add a buy-in to a player's stack (admin only)\n` +
        `• /removebuyin – remove a player's buy-in (admin only)\n` +
        `• /room <roomId> – view active and past room info, players, buy-ins, and cashouts\n` +
        `• /myrooms – see your previous rooms\n` +
        `• /setwallet <address> – set your solana or base wallet to receive payouts\n\n` +
        `shuffle up and deal - your next hand is waiting🃏`,
        {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📖 View Commands', 'show_help')],
                [Markup.button.callback('🎯 Create Room', 'create_room_now')],
                [Markup.button.callback('💳 Setup Wallet', 'setup_wallet_help')]
            ])
        }
    );
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

// register payment commands
registerStacPay(bot);
registerSetWallet(bot);
registerTestPay(bot);

// Set bot commands (appears in menu button)
bot.telegram.setMyCommands([
    { command: 'start', description: '🎯 Start the bot' },
    { command: 'help', description: '📖 Show all commands' },
    { command: 'createroom', description: '🎯 Create a new game room' },
    { command: 'myrooms', description: '🏠 View your rooms' },
    { command: 'invite', description: '👥 Invite a player' },
    { command: 'joinroom', description: '✅ Join a room' },
    { command: 'room', description: '📊 View room details' },
    { command: 'addbuyin', description: '💰 Add buy-in' },
    { command: 'removebuyin', description: '💸 Remove buy-in' },
    { command: 'cashout', description: '🎰 Record cashout' },
    { command: 'summary', description: '📊 View summary' },
    { command: 'settle', description: '💸 Settle payments' },
    { command: 'setwallet', description: '💳 Setup wallet' },
    { command: 'stacpay', description: '💳 Create payment' },
    { command: 'ping', description: '🏓 Check bot status' }
]).catch(err => console.error('Failed to set commands:', err));

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
