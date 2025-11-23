import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import { loggingMiddleware } from './middleware/logging';
import { registerCreateRoom, registerInvite } from './commands';
import { formatLatency } from './utils/format';

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('error: bot_token not set in .env');
    process.exit(1);
}

const bot = new Telegraf<Context>(token);

// middleware
bot.use(loggingMiddleware);

// /start command
bot.start((ctx) => {
    const name = ctx.from?.first_name ?? 'there';
    return ctx.reply(`hey ${name}👋 i'm stac🎯\ntype /help to see commands.`);
});

// /help command
bot.command('help', (ctx) => {
    return ctx.reply(
        `i understand these commands:\n\n` +
        `/start - start the bot\n` +
        `/help - show help\n` +
        `/ping - check latency\n` +
        `/createroom - create a new room\n` +
        `/invite <roomId> @username - invite player to room`
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
