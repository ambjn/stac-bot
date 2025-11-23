import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerRemoveBuyIn = (bot: Telegraf<Context>) => {
    bot.command('removebuyin', (ctx) => {
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

        const room = rooms.get(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is owner or player
        const isOwner = room.ownerId === userId;
        const player = room.players.find(p => p.userId === userId || p.username === username);

        if (!isOwner && !player) {
            return ctx.reply('❌ you are not a member of this room.');
        }

        if (player && !player.joined) {
            return ctx.reply('❌ you need to join the room first.');
        }

        // get the target player record
        let targetPlayer = player;
        if (isOwner && !player) {
            targetPlayer = room.players.find(p => p.userId === userId);
        }

        if (!targetPlayer) {
            return ctx.reply('❌ you have no buy-in to remove.');
        }

        // validate no negative totals
        if (targetPlayer.buyIn < amount) {
            return ctx.reply(
                `❌ cannot remove ${formatCurrency(amount)}.\n\n` +
                `your current buy-in is ${formatCurrency(targetPlayer.buyIn)}.`
            );
        }

        // remove buy-in
        targetPlayer.buyIn -= amount;
        targetPlayer.history.push({
            amount,
            action: 'remove',
            timestamp: new Date()
        });

        ctx.reply(
            `💸 removed ${formatCurrency(amount)} buy-in\n\n` +
            `👤 @${targetPlayer.username}\n` +
            `📊 total: ${formatCurrency(targetPlayer.buyIn)}`
        );
    });
};
