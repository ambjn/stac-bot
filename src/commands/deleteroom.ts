import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, deleteRoom, getRoomsByUser } from '../db';
import { parseCommandArgs } from '../utils/parse';

export const registerDeleteRoom = (bot: Telegraf<Context>) => {
    bot.command('deleteroom', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // if no roomId provided, try to auto-detect
        let targetRoomId: string;

        if (!roomId) {
            // get rooms owned by user
            const userRooms = await getRoomsByUser(userId, username);
            const ownedRooms = userRooms.filter(r => r.role === '👑 owner');

            if (ownedRooms.length === 0) {
                return ctx.reply(
                    `❌ *No Rooms Found*\n\n` +
                    `You don't own any rooms to delete.\n\n` +
                    `Use \`/myrooms\` to see all your rooms.`,
                    { parse_mode: 'Markdown' }
                );
            }

            if (ownedRooms.length === 1) {
                targetRoomId = ownedRooms[0].id;
            } else {
                // show room selector
                const roomList = ownedRooms.map((r, i) => `${i + 1}. \`${r.id}\``).join('\n');
                return ctx.reply(
                    `🗑️ *Delete Room*\n\n` +
                    `You have multiple rooms. Specify which one to delete:\n\n` +
                    `${roomList}\n\n` +
                    `*Usage:*\n` +
                    `\`/deleteroom <roomId>\`\n\n` +
                    `*Example:*\n` +
                    `\`/deleteroom ${ownedRooms[0].id}\``,
                    { parse_mode: 'Markdown' }
                );
            }
        } else {
            targetRoomId = roomId;
        }

        const room = await getRoom(targetRoomId);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${targetRoomId}\` doesn't exist.`,
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
            `🎯 *Room ID:* \`${targetRoomId}\`\n` +
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
                        Markup.button.callback('✅ Confirm Delete', `confirm_delete_${targetRoomId}`),
                        Markup.button.callback('❌ Cancel', 'cancel_delete')
                    ]
                ])
            }
        );
    });

};
