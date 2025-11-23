import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('Error: BOT_TOKEN not set in .env');
    process.exit(1);
}

const bot = new Telegraf<Context>(token);

bot.use(async (ctx, next) => {
    const from = ctx.from?.username ?? `${ctx.from?.first_name ?? ''} ${ctx.from?.last_name ?? ''}`;
    console.log(`[${new Date().toISOString()}] ${from} -> ${ctx.message?.text ?? ctx.updateType}`);
    try {
        await next();
    } catch (err) {
        console.error('middleware caught error:', err);
        try { await ctx.reply('sorry, something went wrong.'); } catch { }
    }
});

bot.start((ctx) => {
    const name = ctx.from?.first_name ?? 'there';
    return ctx.reply(`hey ${name}👋 i'm stac🎯\ntype /help to see commands.`);
});

// /help
bot.command('help', (ctx) => {
    return ctx.replyWithMarkdownV2( 
        `I understand these commands:\n` +
        `/start - start the bot\n` +
        `/help - show help\n` +
        `/ping - check latency\n`
    );
});

// /ping
bot.command('ping', async (ctx) => {
    const start = Date.now();
    const sent = await ctx.reply('Pinging…');
    const latency = Date.now() - start;
    try {
         await ctx.telegram.editMessageText(ctx.chat!.id, sent.message_id, undefined, `Pong! ${latency}ms`);
    } catch {
        // fallback if edit fails (private chats or permissions)
        await ctx.reply(`Pong! ${latency}ms`);
    }
});

// global error handler
bot.catch((err, ctx) => {
    console.error(`global error for update ${ctx.updateType}`, err);
});

// start polling (recommended for dev / simple hosting)
(async () => {
    try {
        await bot.launch();
        console.log('Bot started (polling). Press Ctrl-C to stop.');
        // graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (err) {
        console.error('Failed to launch bot:', err);
        process.exit(1);
    }
})();
