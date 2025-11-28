import { Context, Telegraf, Markup } from 'telegraf';
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
            `room created: ${roomId}\n\n` +
            `invite players → /invite ${roomId} @username\n` +
            `view room → /room ${roomId}`,
            {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('👥 Invite Players', `invite_help_${roomId}`)],
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
                ])
            }
        );
    });

    // Callback handlers
    bot.action(/invite_help_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `/invite <roomId> @username, @username, @username\n\n` +
            `example:\n` +
            `/invite ${roomId} @alex, @maria, @tom\n\n` +
            `note:\n` +
            `you can invite multiple users at once by separating their usernames with a comma.`
        );
    });

    bot.action(/view_room_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `/room <roomId>\n\n` +
            `example:\n` +
            `/room ${roomId}\n\n` +
            `note:\n` +
            `you can use this command to view both your active rooms and your past rooms.`
        );
    });

    bot.action('dismiss', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    });
};
