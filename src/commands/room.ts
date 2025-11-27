import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerRoom = (bot: Telegraf<Context>) => {
    bot.command('room', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply(
                `🎯 *View Room Details*\n\n` +
                `*Usage:*\n` +
                `\`/room <roomId>\`\n\n` +
                `*Example:*\n` +
                `\`/room abc123\`\n\n` +
                `Use \`/myrooms\` to see all your rooms!`,
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

        // check if user has access to this room
        const isOwner = room.ownerId === userId;
        const player = await getPlayer(roomId, userId, username);

        if (!isOwner && !player) {
            return ctx.reply(
                `🚫 *Access Denied*\n\n` +
                `You don't have access to room \`${roomId}\`.\n\n` +
                `Only the owner and invited players can view this room.`,
                { parse_mode: 'Markdown' }
            );
        }

        // build room info
        const playerList = room.players.length > 0
            ? room.players.map(p => {
                const status = p.joined ? '✅' : '⏳';
                const buyInStr = p.buyIn > 0 ? `₹${formatCurrency(p.buyIn)}` : 'No buy-in yet';
                return `${status} @${p.username}\n   💰 ${buyInStr}`;
            }).join('\n\n')
            : 'No players invited yet';

        const totalBuyIn = room.players.reduce((sum, p) => sum + p.buyIn, 0);
        const joinedCount = room.players.filter(p => p.joined).length;
        const statusEmoji = room.settled ? '✅' : '🎮';

        const info =
            `${statusEmoji} *ROOM DETAILS*\n\n` +
            `🎯 *Room ID:* \`${room.id}\`\n` +
            `👑 *Owner:* @${room.ownerUsername}\n` +
            `📅 *Created:* ${room.createdAt.toLocaleDateString()}\n` +
            `📊 *Status:* ${room.settled ? 'Settled' : 'Active'}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `👥 *PLAYERS* (${joinedCount}/${room.players.length})\n\n` +
            `${playerList}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💵 *Total Buy-ins:* ₹${formatCurrency(totalBuyIn)}`;

        const buttons = isOwner
            ? [
                [Markup.button.callback('👥 Invite Players', `invite_help_${roomId}`)],
                [Markup.button.callback('📊 View Summary', `summary_${roomId}`)],
                [Markup.button.callback('💸 Settle Room', `settle_help_${roomId}`)]
            ]
            : [
                [Markup.button.callback('💰 Add Buy-in', `addbuyin_help_${roomId}`)],
                [Markup.button.callback('📊 View Summary', `summary_${roomId}`)],
                [Markup.button.callback('💳 My Wallet', 'my_wallet')]
            ];

        ctx.reply(info, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    });

    // Callback handlers
    bot.action(/summary_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `📊 *View Summary*\n\n` +
            `Use: \`/summary ${roomId}\`\n\n` +
            `This shows detailed buy-ins and standings!`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action(/settle_help_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `💸 *Settle Room*\n\n` +
            `Use: \`/settle ${roomId}\`\n\n` +
            `⚠️ Make sure all players have:\n` +
            `• Recorded their cashouts\n` +
            `• Set up their wallet address\n\n` +
            `The bot will automatically calculate who owes whom and send payment links!`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action('my_wallet', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            `💳 *My Wallet*\n\n` +
            `Use: \`/setwallet\`\n\n` +
            `This shows your current wallet or helps you set one up!`,
            { parse_mode: 'Markdown' }
        );
    });
};
