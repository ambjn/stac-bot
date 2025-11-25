import { Context, Telegraf } from 'telegraf';
import { createRoom } from '../db';
import { generateRoomId } from '../utils/format';

export const registerCreateRoom = (bot: Telegraf<Context>) => {
    bot.command('createroom', async (ctx) => {
        const roomId = generateRoomId();
        const ownerId = ctx.from!.id;
        const ownerUsername = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        await createRoom({
            id: roomId,
            ownerId,
            ownerUsername
        });

        ctx.reply(
            `🎉 room created: ${roomId}\n\n` +
            `invite players using:\n/invite ${roomId} @username\n\n` +
            `view room with:\n/room ${roomId}`
        );
    });
};
