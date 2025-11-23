import { Context, Telegraf } from 'telegraf';
import { getRoom, getPlayer, calculateSettlement, setRoomSettled } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerSettle = (bot: Telegraf<Context>) => {
    bot.command('settle', (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply('usage: /settle <roomId>');
        }

        const room = getRoom(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check access
        const isOwner = room.ownerId === userId;
        const player = getPlayer(roomId, userId, username);

        if (!isOwner && (!player || !player.joined)) {
            return ctx.reply('❌ you don\'t have access to this room.');
        }

        // calculate settlement
        const settlement = calculateSettlement(roomId);
        if (!settlement) {
            return ctx.reply('❌ failed to calculate settlement.');
        }

        // check if all players have cashed out
        const playersWithoutCashout = settlement.players.filter(p => p.buyIn > 0 && p.cashOut === 0);
        if (playersWithoutCashout.length > 0) {
            const names = playersWithoutCashout.map(p => `@${p.username}`).join(', ');
            return ctx.reply(
                `⚠️ waiting for cashouts from:\n${names}\n\n` +
                `use /cashout ${roomId} <amount> to record final chips.`
            );
        }

        // build the settlement message
        const lines: string[] = [];

        // header
        lines.push(`┌─────────────────────────┐`);
        lines.push(`│   📊 SETTLEMENT         │`);
        lines.push(`│   room: ${roomId.padEnd(14)}│`);
        lines.push(`└─────────────────────────┘`);
        lines.push(``);

        // player table header
        lines.push(`┌──────────────┬──────────┬──────────┐`);
        lines.push(`│ PLAYER       │  BUY IN  │  PAYOUT  │`);
        lines.push(`├──────────────┼──────────┼──────────┤`);

        // player rows
        settlement.players.forEach(p => {
            const name = p.username.length > 10 ? p.username.slice(0, 10) + '..' : p.username;
            const buyIn = formatCurrency(p.buyIn).padStart(8);
            const pnlValue = p.pnl;
            const pnlStr = pnlValue >= 0
                ? `+${formatCurrency(pnlValue)}`.padStart(8)
                : `-${formatCurrency(Math.abs(pnlValue))}`.padStart(8);
            const pnlColor = pnlValue >= 0 ? '' : '';

            lines.push(`│ ${name.padEnd(12)} │ ${buyIn} │ ${pnlStr} │`);
        });

        lines.push(`└──────────────┴──────────┴──────────┘`);

        // mismatch warning
        if (Math.abs(settlement.mismatch) > 0.01) {
            lines.push(``);
            lines.push(`⚠️ mismatch of ₹${formatCurrency(Math.abs(settlement.mismatch))} recorded.`);
        }

        // settlements section
        if (settlement.settlements.length > 0) {
            lines.push(``);
            lines.push(`┌─────────────────────────┐`);
            lines.push(`│   💸 SETTLEMENTS        │`);
            lines.push(`└─────────────────────────┘`);
            lines.push(``);

            // group settlements by winner
            const byWinner = new Map<string, { from: string; amount: number }[]>();
            settlement.settlements.forEach(s => {
                if (!byWinner.has(s.to)) {
                    byWinner.set(s.to, []);
                }
                byWinner.get(s.to)!.push({ from: s.from, amount: s.amount });
            });

            byWinner.forEach((payments, winner) => {
                const totalWin = payments.reduce((sum, p) => sum + p.amount, 0);
                lines.push(`🏆 @${winner} wins ₹${formatCurrency(totalWin)} in total`);
                payments.forEach(p => {
                    lines.push(`   └─ @${p.from} owes ₹${formatCurrency(p.amount)}`);
                });
                lines.push(``);
            });
        }

        // mark as settled if owner
        if (isOwner && !room.settled) {
            setRoomSettled(roomId, true);
            lines.push(`✅ room marked as settled.`);
        }

        ctx.reply(lines.join('\n'));
    });
};
