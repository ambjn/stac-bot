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
            `room created: \`${roomId}\`\n\n` +
            `invite players → \`/invite ${roomId}\`\n` +
            `view room → \`/room ${roomId}\``,
            {
                parse_mode: 'Markdown',
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

        // Execute the room command logic directly
        const { getRoom, getPlayer } = require('../db');
        const { formatCurrency } = require('../utils/format');

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${roomId}\` doesn't exist.`,
                { parse_mode: 'Markdown' }
            );
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user has access to this room
        const isOwner = room.ownerId === userId;
        const player = await getPlayer(roomId, userId, username);

        if (!isOwner && !player) {
            return ctx.reply(
                `🚫 *Access Denied*\n\n` +
                `You don't have access to room \`${roomId}\`.\n\n` +
                `Only the owner and invited players can view this room.`,
                { parse_mode: 'Markdown' }
            );
        }

        // build room info
        const playerList = room.players.length > 0
            ? room.players.map((p: any) => {
                const status = p.joined ? '✅' : '⏳';
                const buyInStr = p.buyIn > 0 ? `₹${formatCurrency(p.buyIn)}` : 'No buy-in yet';
                return `${status} @${p.username}\n   💰 ${buyInStr}`;
            }).join('\n\n')
            : 'No players invited yet';

        const totalBuyIn = room.players.reduce((sum: number, p: any) => sum + p.buyIn, 0);
        const joinedCount = room.players.filter((p: any) => p.joined).length;
        const statusEmoji = room.settled ? '✅' : '🎮';

        const info =
            `${statusEmoji} *ROOM DETAILS*\n\n` +
            `🎯 *Room ID:* \`${room.id}\`\n` +
            `👑 *Owner:* @${room.ownerUsername}\n` +
            `📅 *Created:* ${room.createdAt.toLocaleDateString()}\n` +
            `📊 *Status:* ${room.settled ? 'Settled' : 'Active'}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `👥 *PLAYERS* (${joinedCount}/${room.players.length})\n\n` +
            `${playerList}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💵 *Total Buy-ins:* ₹${formatCurrency(totalBuyIn)}`;

        const buttons = isOwner
            ? [
                [Markup.button.callback('👥 Invite Players', `invite_help_${roomId}`)],
                [Markup.button.callback('📊 View Summary', `summary_${roomId}`)],
                [Markup.button.callback('💸 Settle Room', `settle_help_${roomId}`)]
            ]
            : [
                [Markup.button.callback('💰 Add Buy-in', `addbuyin_help_${roomId}`)],
                [Markup.button.callback('📊 View Summary', `summary_${roomId}`)],
                [Markup.button.callback('💳 My Wallet', 'my_wallet')]
            ];

        ctx.reply(info, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    });

    bot.action('dismiss', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    });
};
