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
                    `💳 *Setup Your Wallet*\n\n` +
                    `You haven't set up your Solana wallet yet.\n\n` +
                    `*How to set up:*\n` +
                    `1️⃣ Copy your Solana wallet address from Phantom\n` +
                    `2️⃣ Use: \`/setwallet <your_address>\`\n\n` +
                    `*Example:*\n` +
                    `\`/setwallet 41Jw4SWMio5tfuqLWhe8QDHaUMoAEZnMV1PaBikrpBko\``,
                    { parse_mode: 'Markdown' }
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
