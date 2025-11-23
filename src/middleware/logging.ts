import { Context, MiddlewareFn } from 'telegraf';

/**
 * extracts display name from telegram context
 */
const getDisplayName = (ctx: Context): string => {
    if (ctx.from?.username) {
        return `@${ctx.from.username}`;
    }
    const firstName = ctx.from?.first_name ?? '';
    const lastName = ctx.from?.last_name ?? '';
    return `${firstName} ${lastName}`.trim() || 'unknown';
};

/**
 * logs incoming updates with timestamp and user info
 */
export const loggingMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
    const from = getDisplayName(ctx);
    const message = ctx.message && 'text' in ctx.message ? ctx.message.text : ctx.updateType;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${from} -> ${message}`);

    try {
        await next();
    } catch (err) {
        console.error('middleware caught error:', err);
        try {
            await ctx.reply('sorry, something went wrong.');
        } catch {
            // ignore reply failures
        }
    }
};
