import { Context, Telegraf, Markup } from 'telegraf';
import { getRoomsByUser } from '../db';

export const registerMyRooms = (bot: Telegraf<Context>) => {
    bot.command('myrooms', async (ctx) => {
        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        const userRooms = await getRoomsByUser(userId, username);

        if (userRooms.length === 0) {
            return ctx.reply(
                `🏠 *My Rooms*\n\n` +
                `You don't have any rooms yet.\n\n` +
                `━━━━━━━━━━━━━━━━━━\n\n` +
                `*Get Started:*\n` +
                `• Create a new room\n` +
                `• Or wait for an invitation!`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🎯 Create Room', 'create_room_now')],
                        [Markup.button.callback('📖 How it Works', 'room_guide')]
                    ])
                }
            );
        }

        // Separate owned and joined rooms
        const ownedRooms = userRooms.filter(r => r.role === '👑 owner');
        const joinedRooms = userRooms.filter(r => r.role === '👤 player');

        let message = `🏠 *MY ROOMS* (${userRooms.length})\n\n`;

        if (ownedRooms.length > 0) {
            message += `👑 *OWNED ROOMS* (${ownedRooms.length})\n`;
            ownedRooms.forEach((r, i) => {
                message += `${i + 1}. \`${r.id}\`\n`;
            });
            message += `\n`;
        }

        if (joinedRooms.length > 0) {
            message += `👤 *JOINED ROOMS* (${joinedRooms.length})\n`;
            joinedRooms.forEach((r, i) => {
                message += `${i + 1}. \`${r.id}\`\n`;
            });
            message += `\n`;
        }

        message += `━━━━━━━━━━━━━━━━━━\n\n`;
        message += `💡 Use \`/room <roomId>\` to view details!`;

        // Create inline keyboard with quick actions
        const buttons = [];

        if (ownedRooms.length > 0) {
            buttons.push([Markup.button.callback('🎯 Create Another Room', 'create_room_now')]);
        }

        buttons.push([Markup.button.callback('📊 View a Room', 'view_room_help')]);
        buttons.push([Markup.button.callback('💳 My Wallet', 'my_wallet')]);

        ctx.reply(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    });

    // Callback handlers
    bot.action('create_room_now', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            `🎯 *Create a New Room*\n\n` +
            `Use: \`/createroom\`\n\n` +
            `This will create a new game room instantly!`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action('view_room_help', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            `🎯 *View Room Details*\n\n` +
            `Use: \`/room <roomId>\`\n\n` +
            `*Example:*\n` +
            `\`/room abc123\`\n\n` +
            `This shows players, buy-ins, and room status!`,
            { parse_mode: 'Markdown' }
        );
    });
};
