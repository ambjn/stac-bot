import { Context, Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import { getRoom, getPlayer, calculateSettlement, setRoomSettled } from '../db';
import { getUserByUsername, getUserWalletAddress } from '../db/users';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';
import { PublicKey } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import BigNumber from 'bignumber.js';
import QRCode from 'qrcode';

export const registerSettle = (bot: Telegraf<Context>) => {
    bot.command('settle', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply('usage: /settle <roomId>');
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check access
        const isOwner = room.ownerId === userId;
        const player = await getPlayer(roomId, userId, username);

        if (!isOwner && (!player || !player.joined)) {
            return ctx.reply('❌ you don\'t have access to this room.');
        }

        // calculate settlement
        const settlement = await calculateSettlement(roomId);
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
            await setRoomSettled(roomId, true);
            lines.push(`✅ room marked as settled.`);
        }

        await ctx.reply(lines.join('\n'));

        // USDC SPL Token mint address on Solana Mainnet
        const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

        // Generate and send QR codes for settlements
        for (const s of settlement.settlements) {
            // Get the recipient's (winner's) wallet address
            const recipientUser = await getUserByUsername(s.to);
            if (!recipientUser) continue;

            const recipientWallet = await getUserWalletAddress(recipientUser.userId);
            if (!recipientWallet) {
                // Notify that recipient needs to set wallet
                await ctx.reply(
                    `⚠️ *Wallet Not Set*\n\n` +
                    `@${s.to} needs to set up their wallet to receive payments.\n\n` +
                    `They should use: /setwallet <address>`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('💬 Remind @' + s.to, `remind_wallet_${s.to}`)]
                        ])
                    }
                );
                continue;
            }

            // Get the payer's (loser's) user ID to send them the QR code
            const payerUser = await getUserByUsername(s.from);
            if (!payerUser) continue;

            try {
                const recipient = new PublicKey(recipientWallet);

                // Create Solana Pay URL for USDC transfer
                const url = encodeURL({
                    recipient,
                    amount: new BigNumber(s.amount),
                    splToken: USDC_MINT,
                    label: `STAC Settlement - Room ${roomId}`,
                    message: `Settlement payment to @${s.to}`,
                    memo: `STAC-${roomId}-${Date.now()}`,
                });

                const solanaUrl = url.toString();
                const clickableUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(solanaUrl)}`;

                // Generate QR code with raw Solana Pay URL for wallet scanners
                const qrBuffer = await QRCode.toBuffer(solanaUrl, {
                    width: 512,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });

                // Send QR code to the payer via DM
                await bot.telegram.sendPhoto(
                    payerUser.userId,
                    { source: qrBuffer },
                    {
                        caption:
                            `💸 *Settlement Payment Due*\n\n` +
                            `*Room:* \`${roomId}\`\n` +
                            `*Pay to:* @${s.to}\n` +
                            `*Amount:* ₹${formatCurrency(s.amount)} (${s.amount} USDC)`,
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('✅ Mark as Paid', `mark_paid_${roomId}_${s.from}_${s.to}`)]
                        ])
                    }
                );

            } catch (err) {
                console.error(`Error generating QR code for ${s.from} -> ${s.to}:`, err);
                await ctx.reply(
                    `❌ failed to generate payment QR for @${s.from} -> @${s.to}`
                );
            }
        }

        if (settlement.settlements.length > 0) {
            await ctx.reply(
                `📬 *Payment QR Codes Sent!*\n\n` +
                `Payment QR codes have been sent via DM to users who owe money.\n\n` +
                `💡 Check your private messages with the bot to complete payments.`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('💬 Open Bot DM', `https://t.me/${bot.botInfo?.username || 'stac_bot'}`)]
                    ])
                }
            );
        }
    });
};
