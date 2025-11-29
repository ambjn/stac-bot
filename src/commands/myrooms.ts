import { Telegraf, Markup, Context } from 'telegraf';
import { getRoomsByUser, getRoom } from '../db';
import { formatCurrency } from '../utils/format';

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
        message += `only rooms you participated in will appear in your history.\n\n`;
        message += `━━━━━━━━━━━━━━━━━━\n\n`;

        // Create inline keyboard with room buttons
        const buttons = [];

        if (ownedRooms.length > 0) {
            message += `👑 *OWNED ROOMS* (${ownedRooms.length})\n\n`;

            for (const room of ownedRooms) {
                message += `🎯 \`${room.id}\`\n`;

                // Add buttons for this room - View and Delete
                buttons.push([
                    Markup.button.callback(`📊 View ${room.id}`, `view_room_${room.id}`),
                    Markup.button.callback(`🗑️ Delete`, `delete_room_${room.id}`)
                ]);
            }
            message += `\n`;
        }

        if (joinedRooms.length > 0) {
            message += `👤 *JOINED ROOMS* (${joinedRooms.length})\n\n`;

            for (const room of joinedRooms) {
                message += `🎯 \`${room.id}\`\n`;

                // Add view button for joined rooms (can't delete)
                buttons.push([
                    Markup.button.callback(`📊 View ${room.id}`, `view_room_${room.id}`)
                ]);
            }
        }

        // Add create room button at the bottom
        buttons.push([Markup.button.callback('➕ Create New Room', 'create_room_now')]);

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

    bot.action('room_guide', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            `📖 *How Straddle Works*\n\n` +
            `1️⃣ Create a room with \`/createroom\`\n` +
            `2️⃣ Invite players with \`/invite\`\n` +
            `3️⃣ Track buy-ins with \`/addbuyin\`\n` +
            `4️⃣ Record cashouts with \`/cashout\`\n` +
            `5️⃣ Settle payments with \`/settle\`\n\n` +
            `💡 All settlements are done onchain using USDC!`,
            { parse_mode: 'Markdown' }
        );
    });

    // Delete room callback - triggers confirmation from deleteroom command
    bot.action(/delete_room_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        const userId = ctx.from!.id;

        await ctx.answerCbQuery();

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${roomId}\` doesn't exist or has been deleted.`,
                { parse_mode: 'Markdown' }
            );
        }

        // check if user is the owner
        if (room.ownerId !== userId) {
            return ctx.reply(
                `🚫 *Admin Only*\n\n` +
                `Only the room owner can delete this room.\n\n` +
                `Room owner: @${room.ownerUsername}`,
                { parse_mode: 'Markdown' }
            );
        }

        // show confirmation
        const playerCount = room.players.length;
        const totalBuyIn = room.players.reduce((sum, p) => sum + p.buyIn, 0);

        await ctx.reply(
            `⚠️ *Confirm Room Deletion*\n\n` +
            `🎯 *Room ID:* \`${roomId}\`\n` +
            `👥 *Players:* ${playerCount}\n` +
            `💰 *Total Buy-ins:* ₹${totalBuyIn}\n` +
            `📊 *Status:* ${room.settled ? 'Settled' : 'Active'}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `⚠️ *Warning:* This action cannot be undone!\n\n` +
            `All room data, player records, and transaction history will be permanently deleted.`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Confirm Delete', `confirm_delete_${roomId}`),
                        Markup.button.callback('❌ Cancel', 'cancel_delete')
                    ]
                ])
            }
        );
    });
};
