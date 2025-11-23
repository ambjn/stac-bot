import { Context, Telegraf } from 'telegraf';
import { getRoomsByUser } from '../db';

export const registerMyRooms = (bot: Telegraf<Context>) => {
    bot.command('myrooms', (ctx) => {
        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        const userRooms = getRoomsByUser(userId, username);

        if (userRooms.length === 0) {
            return ctx.reply('you have no rooms yet.\n\nuse /createroom to create one!');
        }

        const list = userRooms
            .map(r => `  ${r.role} - ${r.id}`)
            .join('\n');

        ctx.reply(`🏠 your rooms:\n\n${list}\n\nuse /room <roomId> to view details.`);
    });
};
