import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerAddBuyIn = (bot: Telegraf<Context>) => {
    bot.command('addbuyin', (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, amountStr] = args;

        if (!roomId || !amountStr) {
            return ctx.reply('usage: /addbuyin <roomId> <amount>');
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

        // if owner, add to their own record (create if needed)
        if (isOwner) {
            let ownerPlayer = room.players.find(p => p.userId === userId);
            if (!ownerPlayer) {
                ownerPlayer = {
                    userId,
                    username: room.ownerUsername,
                    buyIn: 0,
                    joined: true,
                    history: []
                };
                room.players.unshift(ownerPlayer); // add owner at start
            }
            ownerPlayer.buyIn += amount;
            ownerPlayer.history.push({
                amount,
                action: 'add',
                timestamp: new Date()
            });

            return ctx.reply(
                `💰 added ${formatCurrency(amount)} buy-in\n\n` +
                `👤 @${room.ownerUsername}\n` +
                `📊 total: ${formatCurrency(ownerPlayer.buyIn)}`
            );
        }

        // add buy-in for player
        player!.buyIn += amount;
        player!.history.push({
            amount,
            action: 'add',
            timestamp: new Date()
        });

        ctx.reply(
            `💰 added ${formatCurrency(amount)} buy-in\n\n` +
            `👤 @${player!.username}\n` +
            `📊 total: ${formatCurrency(player!.buyIn)}`
        );
    });
};
