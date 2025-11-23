import { Context, Telegraf } from 'telegraf';
import { rooms } from '../state/rooms';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerSummary = (bot: Telegraf<Context>) => {
    bot.command('summary', (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply('usage: /summary <roomId>');
        }

        const room = rooms.get(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check access
        const isOwner = room.ownerId === userId;
        const isPlayer = room.players.some(p =>
            (p.userId === userId || p.username === username) && p.joined
        );

        if (!isOwner && !isPlayer) {
            return ctx.reply('❌ you don\'t have access to this room.');
        }

        // calculate totals
        const activePlayers = room.players.filter(p => p.joined || p.buyIn > 0);
        const totalBuyIn = activePlayers.reduce((sum, p) => sum + p.buyIn, 0);

        if (activePlayers.length === 0) {
            return ctx.reply(
                `📊 room summary: ${roomId}\n\n` +
                `👑 owner: @${room.ownerUsername}\n` +
                `📅 created: ${room.createdAt.toLocaleDateString()}\n\n` +
                `no players with buy-ins yet.`
            );
        }

        // sort by buy-in descending
        const sortedPlayers = [...activePlayers].sort((a, b) => b.buyIn - a.buyIn);

        // build player list with percentages
        const playerLines = sortedPlayers.map((p, i) => {
            const percentage = totalBuyIn > 0 ? (p.buyIn / totalBuyIn * 100).toFixed(1) : '0.0';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
            const status = p.joined ? '' : ' ⏳';
            return `${medal} @${p.username}${status}\n    ${formatCurrency(p.buyIn)} (${percentage}%)`;
        });

        // build summary
        const summary = [
            `📊 room summary: ${roomId}`,
            ``,
            `👑 owner: @${room.ownerUsername}`,
            `📅 created: ${room.createdAt.toLocaleDateString()}`,
            ``,
            `━━━━━━━━━━━━━━━━━━`,
            `👥 players (${activePlayers.length})`,
            `━━━━━━━━━━━━━━━━━━`,
            ``,
            ...playerLines,
            ``,
            `━━━━━━━━━━━━━━━━━━`,
            `💰 total: ${formatCurrency(totalBuyIn)}`,
            `━━━━━━━━━━━━━━━━━━`,
        ].join('\n');

        ctx.reply(summary);
    });
};
