import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { parseCommandArgs, parseUsername } from '../utils/parse';

export const registerInvite = (bot: Telegraf<Context>) => {
    bot.command('invite', async (ctx) => {
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

        // only owner can invite
        if (room.ownerId !== ctx.from!.id) {
            return ctx.reply('❌ only the room owner can invite players.');
        }

        const username = parseUsername(rawUser);

        // check if already invited
        const existing = room.players.find(p => p.username === username);
        if (existing) {
            return ctx.reply(`ℹ️ @${username} is already invited to this room.`);
        }

        room.players.push({
            userId: 0, // will be set when they join
            username,
            buyIn: 0,
            joined: false
        });

        // get bot username for deep link
        const botInfo = await ctx.telegram.getMe();
        const joinLink = `https://t.me/${botInfo.username}?start=join_${roomId}`;

        ctx.reply(
            `✅ invited @${username} to room ${roomId}\n\n` +
            `🔗 share this link to join:\n${joinLink}`
        );
    });
};
