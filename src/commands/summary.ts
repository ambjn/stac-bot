import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerSummary = (bot: Telegraf<Context>) => {
    bot.command('summary', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply(
                `📊 *View Summary*\n\n` +
                `*Usage:*\n` +
                `\`/summary <roomId>\`\n\n` +
                `*Example:*\n` +
                `\`/summary abc123\`\n\n` +
                `💡 Shows detailed standings and buy-ins for all players!`,
                { parse_mode: 'Markdown' }
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
        const activePlayers = room.players.filter(p => p.joined || p.buyIn > 0);
        const totalBuyIn = activePlayers.reduce((sum, p) => sum + p.buyIn, 0);

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
};
