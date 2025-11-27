import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { PublicKey } from '@solana/web3.js';
import { encodeURL, createQR } from '@solana/pay';
import BigNumber from 'bignumber.js';
import QRCode from 'qrcode';

// USDC SPL Token mint address on Solana Mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Payment API URL from environment
const PAYMENT_API_URL = process.env.PAYMENT_API_URL || 'http://192.168.1.8:3000/pay';

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
                link: new URL(PAYMENT_API_URL),
            });

            const solanaUrl = url.toString();

            // Send Solana Pay URL with redirect button
            await ctx.reply(
                `✅ *Payment Link Created!*\n\n` +
                `💰 *Amount:* ${amount} USDC\n` +
                `📍 *Recipient:* \`${recipientAddress}\`\n\n` +
                `🔗 *Payment URL:*\n${solanaUrl}`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('💳 PAY', PAYMENT_API_URL)]
                    ])
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
