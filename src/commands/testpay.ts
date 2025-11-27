import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { PublicKey } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import BigNumber from 'bignumber.js';

// USDC SPL Token mint address on Solana Mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Fixed test parameters
const TEST_WALLET = '41Jw4SWMio5tfuqLWhe8QDHaUMoAEZnMV1PaBikrpBko';
const TEST_AMOUNT = 5;

// Payment API URL from environment
const PAYMENT_API_URL = process.env.PAYMENT_API_URL || 'http://192.168.1.8:3000/pay';

export function registerTestPay(bot: Telegraf<Context>) {
    bot.command('testpay', async (ctx) => {
        try {
            // Validate recipient address
            const recipient = new PublicKey(TEST_WALLET);

            // Create Solana Pay URL for USDC transfer
            const url = encodeURL({
                recipient,
                amount: new BigNumber(TEST_AMOUNT),
                splToken: USDC_MINT,
                label: 'STAC Test Payment',
                message: `Test payment of ${TEST_AMOUNT} USDC`,
                memo: `STAC-TEST-${Date.now()}`,
                link: new URL(PAYMENT_API_URL),
            });

            const solanaUrl = url.toString();

            // Build payment API URL with parameters
            const paymentUrl = `${PAYMENT_API_URL}?recipient=${encodeURIComponent(TEST_WALLET)}&amount=${TEST_AMOUNT}`;

            // Send message with URL button
            await ctx.reply(
                `🧪 *Test Payment*\n\n` +
                `💰 *Amount:* ${TEST_AMOUNT} USDC\n` +
                `📍 *Recipient:* \`${TEST_WALLET}\`\n\n` +
                `Click the button below to proceed with payment.`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('💳 PAY', paymentUrl)]
                    ])
                }
            );

        } catch (err) {
            console.error('Error creating test payment link:', err);
            return ctx.reply(
                `❌ *Error Creating Test Payment Link*\n\n` +
                `${err instanceof Error ? err.message : 'Unknown error'}`,
                { parse_mode: 'Markdown' }
            );
        }
    });
}
