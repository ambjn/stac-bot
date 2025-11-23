import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { parseCommandArgs, parseUsername } from '../utils/parse';

export const registerInvite = (bot: Telegraf<Context>) => {
    bot.command('invite', (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, rawUser] = args;

        if (!roomId || !rawUser) {
            return ctx.reply('usage: /invite <roomId> @username');
        }

        const room = rooms.get(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const username = parseUsername(rawUser);
        room.players.push({
            username,
            buyIn: 0
        });

        ctx.reply(`✅ added @${username} to room ${roomId}`);
    });
};
