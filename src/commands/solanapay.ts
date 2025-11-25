import { Telegraf, Context } from 'telegraf';
import { PublicKey } from '@solana/web3.js';
import { encodeURL, createQR } from '@solana/pay';
import BigNumber from 'bignumber.js';

// USDC SPL Token mint address on Solana (mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// USDC SPL Token mint address on Solana Devnet (for testing)
const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

export function registerSolanaPay(bot: Telegraf<Context>) {
    bot.command('solanapay', async (ctx) => {
        const args = ctx.message?.text?.split(' ').slice(1) || [];

        if (args.length < 2) {
            return ctx.reply(
                `❌ usage: /solanapay <address> <amount>\n\n` +
                `example: /solanapay 41Jw4SWMio5tfuqLWhe8QDHaUMoAEZnMV1PaBikrpBko 5\n\n` +
                `this creates a solana pay link for USDC (devnet) payment.`
            );
        }

        const recipientAddress = args[0];
        const amountStr = args[1];

        // Validate amount
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply(`❌ invalid amount: ${amountStr}`);
        }

        try {
            // Validate recipient address
            const recipient = new PublicKey(recipientAddress);

            // Create Solana Pay URL for USDC transfer
            // Using devnet USDC for testing
            const url = encodeURL({
                recipient,
                amount: new BigNumber(amount),
                splToken: USDC_DEVNET_MINT, // Use USDC_MINT for mainnet
                label: 'STAC Payment',
                message: `Payment of ${amount} USDC`,
                memo: `STAC-${Date.now()}`,
            });

            const paymentUrl = url.toString();

            return ctx.reply(
                `✅ solana pay link created!\n\n` +
                `💰 amount: ${amount} USDC (devnet)\n` +
                `📍 recipient: ${recipientAddress}\n\n` +
                `🔗 payment link:\n${paymentUrl}\n\n` +
                `scan this QR code or click the link to pay with a solana wallet (phantom, solflare, etc.)\n\n` +
                `⚠️ note: this uses devnet USDC for testing. for mainnet, update the token mint address.`
            );

        } catch (err) {
            console.error('Error creating Solana Pay link:', err);
            return ctx.reply(
                `❌ error creating payment link.\n\n` +
                `make sure the address is valid: ${recipientAddress}`
            );
        }
    });

    // Shortcut command for the specific address mentioned
    bot.command('testpay', async (ctx) => {
        const testAddress = '41Jw4SWMio5tfuqLWhe8QDHaUMoAEZnMV1PaBikrpBko';
        const amount = 5;

        try {
            const recipient = new PublicKey(testAddress);

            const url = encodeURL({
                recipient,
                amount: new BigNumber(amount),
                splToken: USDC_DEVNET_MINT,
                label: 'STAC Test Payment',
                message: `Test payment of ${amount} USDC`,
                memo: `STAC-TEST-${Date.now()}`,
            });

            const paymentUrl = url.toString();

            return ctx.reply(
                `✅ test payment link created!\n\n` +
                `💰 amount: ${amount} USDC (devnet)\n` +
                `📍 recipient: ${testAddress}\n\n` +
                `🔗 payment link:\n${paymentUrl}\n\n` +
                `scan this QR code or click the link to pay with a solana wallet!`
            );

        } catch (err) {
            console.error('Error creating test payment link:', err);
            return ctx.reply(`❌ error creating test payment link.`);
        }
    });
}
