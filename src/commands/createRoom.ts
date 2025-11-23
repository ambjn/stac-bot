import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { Room } from '../state/types';
import { generateRoomId } from '../utils/format';

export const registerCreateRoom = (bot: Telegraf<Context>) => {
    bot.command('createroom', (ctx) => {
        const roomId = generateRoomId();
        const ownerId = ctx.from!.id;
        const ownerUsername = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        const room: Room = {
            id: roomId,
            ownerId,
            ownerUsername,
            players: [],
            createdAt: new Date()
        };

        rooms.set(roomId, room);

        ctx.reply(
            `🎉 room created: ${roomId}\n\n` +
            `invite players using:\n/invite ${roomId} @username\n\n` +
            `view room with:\n/room ${roomId}`
        );
    });
};
