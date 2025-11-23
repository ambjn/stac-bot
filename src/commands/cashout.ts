import { Context, Telegraf } from 'telegraf';
import { getRoom, getPlayer, updatePlayerCashOut } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerCashOut = (bot: Telegraf<Context>) => {
    bot.command('cashout', (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, amountStr] = args;

        if (!roomId || !amountStr) {
            return ctx.reply('usage: /cashout <roomId> <amount>');
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount < 0) {
            return ctx.reply('❌ amount must be a non-negative number.');
        }

        const room = getRoom(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        if (room.settled) {
            return ctx.reply('❌ this room has already been settled.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is owner or player
        const isOwner = room.ownerId === userId;
        const player = getPlayer(roomId, userId, username);

        if (!isOwner && !player) {
            return ctx.reply('❌ you are not a member of this room.');
        }

        if (player && !player.joined) {
            return ctx.reply('❌ you need to join the room first.');
        }

        // update cash out
        const targetUsername = isOwner ? room.ownerUsername : player!.username;
        const result = updatePlayerCashOut(roomId, userId, targetUsername, amount);

        if (!result.success) {
            return ctx.reply(`❌ ${result.error}`);
        }

        // get updated player info
        const updatedPlayer = getPlayer(roomId, userId, targetUsername);
        const pnl = amount - (updatedPlayer?.buyIn ?? 0);
        const pnlStr = pnl >= 0 ? `+${formatCurrency(pnl)}` : `-${formatCurrency(Math.abs(pnl))}`;
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';

        ctx.reply(
            `🎰 cashout recorded!\n\n` +
            `👤 @${targetUsername}\n` +
            `💵 buy-in: ${formatCurrency(updatedPlayer?.buyIn ?? 0)}\n` +
            `💰 cashout: ${formatCurrency(amount)}\n` +
            `${pnlEmoji} p&l: ${pnlStr}`
        );
    });
};
