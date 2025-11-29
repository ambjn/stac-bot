import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerRoom = (bot: Telegraf<Context>) => {
    bot.command('room', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply(
                `/room <roomId>\n\n` +
                `note:\n` +
                `you can use this command to view both your active rooms and your past rooms.`
            );
        }

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
            ? room.players.map(p => {
                const status = p.joined ? '✅' : '⏳';
                const buyInStr = p.buyIn > 0 ? `₹${formatCurrency(p.buyIn)}` : 'No buy-in yet';
                return `${status} @${p.username}\n   💰 ${buyInStr}`;
            }).join('\n\n')
            : 'No players invited yet';

        const totalBuyIn = room.players.reduce((sum, p) => sum + p.buyIn, 0);
        const joinedCount = room.players.filter(p => p.joined).length;
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

    // Callback handlers
    bot.action(/summary_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();

        // Execute the summary command logic directly
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

        // check access
        const isOwner = room.ownerId === userId;
        const player = await getPlayer(roomId, userId, username);

        if (!isOwner && (!player || !player.joined)) {
            return ctx.reply(
                `🚫 *Access Denied*\n\n` +
                `You don't have access to room \`${roomId}\`.`,
                { parse_mode: 'Markdown' }
            );
        }

        // calculate totals
        const activePlayers = room.players.filter((p: any) => p.joined || p.buyIn > 0);
        const totalBuyIn = activePlayers.reduce((sum: number, p: any) => sum + p.buyIn, 0);

        if (activePlayers.length === 0) {
            return ctx.reply(
                `📊 *ROOM SUMMARY*\n\n` +
                `🎯 *Room:* \`${roomId}\`\n` +
                `👑 *Owner:* @${room.ownerUsername}\n` +
                `📅 *Created:* ${room.createdAt.toLocaleDateString()}\n\n` +
                `━━━━━━━━━━━━━━━━━━\n\n` +
                `⚠️ No players with buy-ins yet.\n\n` +
                `💡 Use \`/addbuyin\` to start tracking!`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('💰 Add Buy-in', `addbuyin_help_${roomId}`)],
                        [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
                    ])
                }
            );
        }

        // sort by buy-in descending
        const sortedPlayers = [...activePlayers].sort((a, b) => b.buyIn - a.buyIn);

        // build player list with percentages
        const playerLines = sortedPlayers.map((p, i) => {
            const percentage = totalBuyIn > 0 ? (p.buyIn / totalBuyIn * 100).toFixed(1) : '0.0';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '   ';
            const status = p.joined ? '' : ' ⏳';
            return `${medal} @${p.username}${status}\n      ₹${formatCurrency(p.buyIn)} (${percentage}%)`;
        });

        // build summary
        const summary = [
            `📊 *ROOM SUMMARY*\n`,
            `🎯 *Room:* \`${roomId}\``,
            `👑 *Owner:* @${room.ownerUsername}`,
            `📅 *Created:* ${room.createdAt.toLocaleDateString()}`,
            `📊 *Status:* ${room.settled ? '✅ Settled' : '🎮 Active'}`,
            ``,
            `━━━━━━━━━━━━━━━━━━`,
            `👥 *PLAYERS* (${activePlayers.length})`,
            `━━━━━━━━━━━━━━━━━━\n`,
            ...playerLines,
            ``,
            `━━━━━━━━━━━━━━━━━━`,
            `💰 *TOTAL BUY-INS*`,
            `₹${formatCurrency(totalBuyIn)}`,
            `━━━━━━━━━━━━━━━━━━`,
        ].join('\n');

        const buttons = isOwner
            ? [
                [Markup.button.callback('💸 Settle Room', `settle_help_${roomId}`)],
                [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
            ]
            : [
                [Markup.button.callback('💰 Add Buy-in', `addbuyin_help_${roomId}`)],
                [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
            ];

        ctx.reply(summary, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    });

    bot.action(/settle_help_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `💸 *Settle Room*\n\n` +
            `Use: \`/settle ${roomId}\`\n\n` +
            `⚠️ Make sure all players have:\n` +
            `• Recorded their cashouts\n` +
            `• Set up their wallet address\n\n` +
            `The bot will automatically calculate who owes whom and send payment links!`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action('my_wallet', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            `💳 *My Wallet*\n\n` +
            `Use: \`/setwallet\`\n\n` +
            `This shows your current wallet or helps you set one up!`,
            { parse_mode: 'Markdown' }
        );
    });
};
