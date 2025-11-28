import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer, updatePlayerBuyIn } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerAddBuyIn = (bot: Telegraf<Context>) => {
    bot.command('addbuyin', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, amountStr] = args;

        if (!roomId || !amountStr) {
            return ctx.reply(
                `/addbuyin <roomId> <amount>\n\n` +
                `example:\n` +
                `/addbuyin abc123 50\n` +
                `/addbuyin abc123 100\n\n` +
                `note:\n` +
                `only room admins can add buy-ins, and the amount is added directly to the player's current stack.`
            );
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply(
                `❌ *Invalid Amount*\n\n` +
                `The amount must be a positive number.\n\n` +
                `You entered: \`${amountStr}\``,
                { parse_mode: 'Markdown' }
            );
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${roomId}\` doesn't exist.\n\n` +
                `Use \`/myrooms\` to see your rooms.`,
                { parse_mode: 'Markdown' }
            );
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is owner or player
        const isOwner = room.ownerId === userId;
        const player = await getPlayer(roomId, userId, username);

        if (!isOwner && !player) {
            return ctx.reply(
                `🚫 *Access Denied*\n\n` +
                `You are not a member of room \`${roomId}\`.`,
                { parse_mode: 'Markdown' }
            );
        }

        if (player && !player.joined) {
            return ctx.reply(
                `⚠️ *Not Joined Yet*\n\n` +
                `You need to join the room first!\n\n` +
                `Use: \`/join ${roomId}\``,
                { parse_mode: 'Markdown' }
            );
        }

        // update buy-in
        const targetUsername = isOwner ? room.ownerUsername : player!.username;
        const result = await updatePlayerBuyIn(roomId, userId, targetUsername, amount, 'add');

        if (!result.success) {
            return ctx.reply(
                `❌ *Error*\n\n${result.error}`,
                { parse_mode: 'Markdown' }
            );
        }

        ctx.reply(
            `✅ *Buy-in Added!*\n\n` +
            `💰 *Amount:* ₹${formatCurrency(amount)}\n` +
            `👤 *Player:* @${targetUsername}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 *Total Buy-in:* ₹${formatCurrency(result.newTotal)}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('💰 Add More', `addmore_${roomId}`)],
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                    [Markup.button.callback('📊 Summary', `summary_${roomId}`)]
                ])
            }
        );
    });

    // Callback handler
    bot.action(/addmore_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `/addbuyin <roomId> <amount>\n\n` +
            `example:\n` +
            `/addbuyin ${roomId} 50\n` +
            `/addbuyin ${roomId} 100\n\n` +
            `note:\n` +
            `only room admins can add buy-ins, and the amount is added directly to the player's current stack.`
        );
    });
};
