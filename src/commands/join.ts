import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, getPlayer, updatePlayerJoined } from '../db';
import { parseCommandArgs } from '../utils/parse';

export const registerJoin = (bot: Telegraf<Context>) => {
    const handleJoin = async (ctx: Context) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId] = args;

        if (!roomId) {
            return ctx.reply(
                `/joinroom <roomId>\n\n` +
                `example:\n` +
                `/joinroom abc123\n\n` +
                `note:\n` +
                `you can only join a room that is active and not closed.`
            );
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${roomId}\` doesn't exist.\n\n` +
                `Make sure you have the correct room ID!`,
                { parse_mode: 'Markdown' }
            );
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username ?? ctx.from!.first_name ?? 'unknown';

        // check if user is the owner
        if (room.ownerId === userId) {
            return ctx.reply(
                `👑 *You're the Owner!*\n\n` +
                `You created this room, so you're already part of it!\n\n` +
                `🎯 *Room:* \`${roomId}\``,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                        [Markup.button.callback('👥 Invite Players', `invite_help_${roomId}`)]
                    ])
                }
            );
        }

        // check if user was invited
        const player = await getPlayer(roomId, userId, username);

        if (!player) {
            return ctx.reply(
                `🚫 *Not Invited*\n\n` +
                `You weren't invited to room \`${roomId}\`.\n\n` +
                `💡 Ask the room owner (@${room.ownerUsername}) to invite you!`,
                { parse_mode: 'Markdown' }
            );
        }

        if (player.joined) {
            return ctx.reply(
                `ℹ️ *Already Joined*\n\n` +
                `You're already a member of this room!\n\n` +
                `🎯 *Room:* \`${roomId}\``,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                        [Markup.button.callback('💰 Add Buy-in', `addbuyin_help_${roomId}`)]
                    ])
                }
            );
        }

        // mark as joined
        await updatePlayerJoined(roomId, player.username, userId);

        ctx.reply(
            `✅ *Welcome to the Game!*\n\n` +
            `You successfully joined room \`${roomId}\`!\n\n` +
            `🎯 *Room Owner:* @${room.ownerUsername}\n` +
            `👥 *Players:* ${room.players.length}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `*Quick Actions:*\n` +
            `• View room details\n` +
            `• Add your buy-ins\n` +
            `• Setup your wallet for payments`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                    [Markup.button.callback('💰 Add Buy-in', `addbuyin_help_${roomId}`)],
                    [Markup.button.callback('💳 Setup Wallet', 'setup_wallet_help')]
                ])
            }
        );
    };

    // Register both join and joinroom commands
    bot.command('join', handleJoin);
    bot.command('joinroom', handleJoin);

    // Callback handler
    bot.action(/addbuyin_help_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `/addbuyin <roomId> <amount>\n\n` +
            `example:\n` +
            `/addbuyin ${roomId} 50\n` +
            `/addbuyin ${roomId} 100\n\n` +
            `note:\n` +
            `only room admins can add buy-ins, and the amount is added directly to the player's current stack.`
        );
    });
};
