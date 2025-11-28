import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { PublicKey } from '@solana/web3.js';
import { setUserWalletAddress, getUserWalletAddress } from '../db/users';

export function registerSetWallet(bot: Telegraf<Context>) {
    bot.command('setwallet', async (ctx) => {
        const args = ctx.message?.text?.split(' ').slice(1) || [];

        if (args.length === 0) {
            // Show current wallet if no args provided
            const userId = ctx.from!.id;
            const currentWallet = await getUserWalletAddress(userId);

            if (currentWallet) {
                return ctx.reply(
                    `💳 *Your Solana Wallet*\n\n` +
                    `\`${currentWallet}\`\n\n` +
                    `This address will receive settlement payments.`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('❌ Remove Wallet', 'remove_wallet')]
                        ])
                    }
                );
            } else {
                return ctx.reply(
                    `/setwallet <address>\n\n` +
                    `examples:\n` +
                    `/setwallet 7Gh....34xyz\n` +
                    `/setwallet 0x91....4e8f\n\n` +
                    `note:\n` +
                    `This wallet will be used for all payouts - double check your address before submitting.`
                );
            }
        }

        const walletAddress = args[0];

        // Validate Solana address
        try {
            new PublicKey(walletAddress);
        } catch (err) {
            return ctx.reply(
                `❌ *Invalid Wallet Address*\n\n` +
                `The address you provided is not a valid Solana address.\n\n` +
                `Please check and try again.`,
                { parse_mode: 'Markdown' }
            );
        }

        // Save wallet address
        const userId = ctx.from!.id;
        const result = await setUserWalletAddress(userId, walletAddress);

        if (!result) {
            return ctx.reply(`❌ Failed to save wallet address. Please try again.`);
        }

        return ctx.reply(
            `✅ *Wallet Address Saved!*\n\n` +
            `💳 \`${walletAddress}\`\n\n` +
            `This address will be used for receiving settlement payments.`,
            { parse_mode: 'Markdown' }
        );
    });

    // Handle remove wallet callback
    bot.action('remove_wallet', async (ctx) => {
        const userId = ctx.from!.id;
        const result = await setUserWalletAddress(userId, '');

        if (result) {
            await ctx.answerCbQuery('Wallet removed successfully');
            await ctx.editMessageText(
                `✅ *Wallet Removed*\n\n` +
                `Your wallet address has been removed.\n\n` +
                `Use /setwallet to add a new one.`,
                { parse_mode: 'Markdown' }
            );
        } else {
            await ctx.answerCbQuery('Failed to remove wallet');
        }
    });
}
