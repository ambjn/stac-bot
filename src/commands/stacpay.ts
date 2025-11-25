import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { PublicKey } from '@solana/web3.js';
import { encodeURL, createQR } from '@solana/pay';
import BigNumber from 'bignumber.js';
import QRCode from 'qrcode';

// USDC SPL Token mint address on Solana Mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export function registerStacPay(bot: Telegraf<Context>) {
    bot.command('stacpay', async (ctx) => {
        const args = ctx.message?.text?.split(' ').slice(1) || [];

        if (args.length < 2) {
            return ctx.reply(
                `💳 *STAC Pay - Create Payment Link*\n\n` +
                `*Usage:*\n` +
                `\`/stacpay <wallet_address> <amount>\`\n\n` +
                `*Example:*\n` +
                `\`/stacpay 41Jw4SWMio5tfuqLWhe8QDHaUMoAEZnMV1PaBikrpBko 5\`\n\n` +
                `This creates a payment QR code for USDC.`,
                { parse_mode: 'Markdown' }
            );
        }

        const recipientAddress = args[0];
        const amountStr = args[1];

        // Validate amount
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply(
                `❌ *Invalid Amount*\n\n` +
                `The amount must be a positive number.\n\n` +
                `You entered: \`${amountStr}\``,
                { parse_mode: 'Markdown' }
            );
        }

        try {
            // Validate recipient address
            const recipient = new PublicKey(recipientAddress);

            // Create Solana Pay URL for USDC transfer
            const url = encodeURL({
                recipient,
                amount: new BigNumber(amount),
                splToken: USDC_MINT,
                label: 'STAC Payment',
                message: `Payment of ${amount} USDC`,
                memo: `STAC-${Date.now()}`,
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

            // Send QR code image
            await ctx.replyWithPhoto(
                { source: qrBuffer },
                {
                    caption:
                        `✅ *Payment QR Code Created!*\n\n` +
                        `💰 *Amount:* ${amount} USDC\n` +
                        `📍 *Recipient:* \`${recipientAddress}\``,
                    parse_mode: 'Markdown'
                }
            );

            return;

        } catch (err) {
            console.error('Error creating Solana Pay link:', err);
            return ctx.reply(
                `❌ *Error Creating Payment Link*\n\n` +
                `Make sure the wallet address is valid.\n\n` +
                `Address: \`${recipientAddress}\``,
                { parse_mode: 'Markdown' }
            );
        }
    });

}
