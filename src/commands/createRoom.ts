import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { Room } from '../state/types';
import { generateRoomId } from '../utils/format';

export const registerCreateRoom = (bot: Telegraf<Context>) => {
    bot.command('createroom', (ctx) => {
        const roomId = generateRoomId();
        const ownerId = ctx.from!.id;

        const room: Room = {
            id: roomId,
            ownerId,
            players: []
        };

        rooms.set(roomId, room);

        ctx.reply(
            `🎉 room created: ${roomId}\n\ninvite players using:\n/invite ${roomId} @username`
        );
    });
};
