import { Context, Telegraf } from 'telegraf';
import { getRoom, getPlayer, updatePlayerBuyIn } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerRemoveBuyIn = (bot: Telegraf<Context>) => {
    bot.command('removebuyin', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, amountStr] = args;

        if (!roomId || !amountStr) {
            return ctx.reply('usage: /removebuyin <roomId> <amount>');
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply('❌ amount must be a positive number.');
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is owner or player
        const isOwner = room.ownerId === userId;
        const player = await getPlayer(roomId, userId, username);

        if (!isOwner && !player) {
            return ctx.reply('❌ you are not a member of this room.');
        }

        if (player && !player.joined) {
            return ctx.reply('❌ you need to join the room first.');
        }

        // check if user has any buy-in
        const targetUsername = isOwner ? room.ownerUsername : player!.username;
        const currentPlayer = await getPlayer(roomId, userId, targetUsername);

        if (!currentPlayer || currentPlayer.buyIn === 0) {
            return ctx.reply('❌ you have no buy-in to remove.');
        }

        // update buy-in
        const result = await updatePlayerBuyIn(roomId, userId, targetUsername, amount, 'remove');

        if (!result.success) {
            return ctx.reply(
                `❌ cannot remove ${formatCurrency(amount)}.\n\n` +
                `your current buy-in is ${formatCurrency(currentPlayer.buyIn)}.`
            );
        }

        ctx.reply(
            `💸 removed ${formatCurrency(amount)} buy-in\n\n` +
            `👤 @${targetUsername}\n` +
            `📊 total: ${formatCurrency(result.newTotal)}`
        );
    });
};
