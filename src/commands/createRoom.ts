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
            `🎉 *Room Created Successfully!*\n\n` +
            `🎯 *Room ID:* \`${roomId}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `*Next Steps:*\n` +
            `👥 Invite players to your room\n` +
            `💰 Track buy-ins and cashouts\n` +
            `💸 Settle payments automatically\n\n` +
            `📋 Use the buttons below for quick actions!`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('👥 Invite Players', `invite_help_${roomId}`)],
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                    [Markup.button.callback('📖 Room Guide', 'room_guide')]
                ])
            }
        );
    });

    // Callback handlers
    bot.action(/invite_help_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `👥 *Invite Players to Room ${roomId}*\n\n` +
            `*How to invite:*\n` +
            `Use: \`/invite ${roomId} @username\`\n\n` +
            `*Example:*\n` +
            `\`/invite ${roomId} @alice\`\n\n` +
            `✨ Players will receive a direct message with a join link!`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action(/view_room_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `🎯 *View Room Details*\n\n` +
            `Use: \`/room ${roomId}\`\n\n` +
            `This will show all players, buy-ins, and room status.`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action('room_guide', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📖 *Room Management Guide*\n\n` +
            `*1️⃣ Create Room*\n` +
            `\`/createroom\` - Start a new game room\n\n` +
            `*2️⃣ Invite Players*\n` +
            `\`/invite <roomId> @username\` - Add players\n\n` +
            `*3️⃣ Track Buy-ins*\n` +
            `\`/addbuyin <roomId> <amount>\` - Record buy-ins\n\n` +
            `*4️⃣ Record Cashouts*\n` +
            `\`/cashout <roomId> <amount>\` - Final chip counts\n\n` +
            `*5️⃣ Settle Payments*\n` +
            `\`/settle <roomId>\` - Calculate & send payment links\n\n` +
            `💡 *Tip:* Make sure all players set their wallet with \`/setwallet\` to receive payments!`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Back', 'dismiss')]
                ])
            }
        );
    });

    bot.action('dismiss', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    });
};
