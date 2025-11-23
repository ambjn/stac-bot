import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';

export const registerMyRooms = (bot: Telegraf<Context>) => {
    bot.command('myrooms', (ctx) => {
        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        const userRooms: { id: string; role: string }[] = [];

        rooms.forEach((room, roomId) => {
            if (room.ownerId === userId) {
                userRooms.push({ id: roomId, role: '👑 owner' });
            } else {
                const isPlayer = room.players.some(p =>
                    (p.userId === userId || p.username === username) && p.joined
                );
                if (isPlayer) {
                    userRooms.push({ id: roomId, role: '👤 player' });
                }
            }
        });

        if (userRooms.length === 0) {
            return ctx.reply('you have no rooms yet.\n\nuse /createroom to create one!');
        }

        const list = userRooms
            .map(r => `  ${r.role} - ${r.id}`)
            .join('\n');

        ctx.reply(`🏠 your rooms:\n\n${list}\n\nuse /room <roomId> to view details.`);
    });
};
