import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { parseCommandArgs } from '../utils/parse';

export const registerRoom = (bot: Telegraf<Context>) => {
    bot.command('room', (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply('usage: /room <roomId>');
        }

        const room = rooms.get(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user has access to this room
        const isOwner = room.ownerId === userId;
        const isPlayer = room.players.some(p => p.userId === userId || p.username === username);

        if (!isOwner && !isPlayer) {
            return ctx.reply('❌ you don\'t have access to this room.');
        }

        // build room info
        const playerList = room.players.length > 0
            ? room.players.map(p => {
                const status = p.joined ? '✅' : '⏳';
                return `  ${status} @${p.username} (buy-in: ${p.buyIn})`;
            }).join('\n')
            : '  no players yet';

        const info = [
            `🎯 room: ${room.id}`,
            `👑 owner: @${room.ownerUsername}`,
            `📅 created: ${room.createdAt.toLocaleDateString()}`,
            ``,
            `👥 players:`,
            playerList
        ].join('\n');

        ctx.reply(info);
    });
};
