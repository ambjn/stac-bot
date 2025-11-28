import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer, updatePlayerCashOut } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerCashOut = (bot: Telegraf<Context>) => {
    bot.command('cashout', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, amountStr] = args;

        if (!roomId || !amountStr) {
            return ctx.reply(
                `/cashout <roomId> <amount>\n\n` +
                `example:\n` +
                `/cashout abc123 320\n\n` +
                `note:\n` +
                `this sets your final chip value for the room - admins will use these values during settlement.`
            );
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount < 0) {
            return ctx.reply(
                `❌ *Invalid Amount*\n\n` +
                `The amount must be a non-negative number.\n\n` +
                `You entered: \`${amountStr}\`\n\n` +
                `💡 Use 0 if you lost all your chips!`,
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

        if (room.settled) {
            return ctx.reply(
                `⚠️ *Room Already Settled*\n\n` +
                `This room has already been settled.\n\n` +
                `You cannot modify cashouts after settlement.`,
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

        // update cash out
        const targetUsername = isOwner ? room.ownerUsername : player!.username;
        const result = await updatePlayerCashOut(roomId, userId, targetUsername, amount);

        if (!result.success) {
            return ctx.reply(
                `❌ *Error*\n\n${result.error}`,
                { parse_mode: 'Markdown' }
            );
        }

        // get updated player info
        const updatedPlayer = await getPlayer(roomId, userId, targetUsername);
        const pnl = amount - (updatedPlayer?.buyIn ?? 0);
        const pnlStr = pnl >= 0 ? `+₹${formatCurrency(pnl)}` : `-₹${formatCurrency(Math.abs(pnl))}`;
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';
        const resultEmoji = pnl > 0 ? '🎉' : pnl < 0 ? '😔' : '🤝';

        ctx.reply(
            `${resultEmoji} *Cashout Recorded!*\n\n` +
            `👤 *Player:* @${targetUsername}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💵 *Buy-in:* ₹${formatCurrency(updatedPlayer?.buyIn ?? 0)}\n` +
            `💰 *Cashout:* ₹${formatCurrency(amount)}\n\n` +
            `${pnlEmoji} *P&L:* ${pnlStr}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💡 Once all players record their cashouts, the owner can settle the room!`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 View Summary', `summary_${roomId}`)],
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
                ])
            }
        );
    });
};
