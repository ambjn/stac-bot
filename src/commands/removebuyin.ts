import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer, updatePlayerBuyIn } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerRemoveBuyIn = (bot: Telegraf<Context>) => {
    bot.command('removebuyin', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, amountStr] = args;

        if (!roomId || !amountStr) {
            return ctx.reply(
                `💸 *Remove Buy-in*\n\n` +
                `*Usage:*\n` +
                `\`/removebuyin <roomId> <amount>\`\n\n` +
                `*Example:*\n` +
                `\`/removebuyin abc123 50\`\n\n` +
                `💡 Use this to correct a mistakenly recorded buy-in!`,
                { parse_mode: 'Markdown' }
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
                `Room \`${roomId}\` doesn't exist.`,
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
                `You need to join the room first!`,
                { parse_mode: 'Markdown' }
            );
        }

        // check if user has any buy-in
        const targetUsername = isOwner ? room.ownerUsername : player!.username;
        const currentPlayer = await getPlayer(roomId, userId, targetUsername);

        if (!currentPlayer || currentPlayer.buyIn === 0) {
            return ctx.reply(
                `❌ *No Buy-in to Remove*\n\n` +
                `You haven't recorded any buy-ins yet.\n\n` +
                `Current buy-in: ₹0`,
                { parse_mode: 'Markdown' }
            );
        }

        // update buy-in
        const result = await updatePlayerBuyIn(roomId, userId, targetUsername, amount, 'remove');

        if (!result.success) {
            return ctx.reply(
                `❌ *Cannot Remove*\n\n` +
                `Cannot remove ₹${formatCurrency(amount)}.\n\n` +
                `Your current buy-in is ₹${formatCurrency(currentPlayer.buyIn)}.\n\n` +
                `💡 You can only remove up to your current total!`,
                { parse_mode: 'Markdown' }
            );
        }

        ctx.reply(
            `✅ *Buy-in Removed!*\n\n` +
            `💸 *Removed:* ₹${formatCurrency(amount)}\n` +
            `👤 *Player:* @${targetUsername}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 *New Total:* ₹${formatCurrency(result.newTotal)}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                    [Markup.button.callback('📊 Summary', `summary_${roomId}`)]
                ])
            }
        );
    });
};
