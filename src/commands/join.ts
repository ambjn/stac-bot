import { Context, Telegraf } from 'telegraf';
import { getRoom, getPlayer, updatePlayerJoined } from '../db';
import { parseCommandArgs } from '../utils/parse';

export const registerJoin = (bot: Telegraf<Context>) => {
    bot.command('join', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply('usage: /join <roomId>');
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is the owner
        if (room.ownerId === userId) {
            return ctx.reply('👑 you are the owner of this room, no need to join!');
        }

        // check if user was invited
        const player = await getPlayer(roomId, userId, username);

        if (!player) {
            return ctx.reply('❌ you were not invited to this room.');
        }

        if (player.joined) {
            return ctx.reply('ℹ️ you already joined this room.');
        }

        // mark as joined
        await updatePlayerJoined(roomId, player.username, userId);

        ctx.reply(`✅ you joined room ${roomId}!\n\nuse /room ${roomId} to see room details.`);
    });
};
