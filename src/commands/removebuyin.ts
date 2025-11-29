import { Telegraf, Markup, Context } from 'telegraf';
import { getRoom, updatePlayerBuyIn, getActiveRoomForOwner } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerRemoveBuyIn = (bot: Telegraf<Context>) => {
    bot.command('removebuyin', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [usernameOrAmount, amountStr] = args;

        if (!usernameOrAmount) {
            return ctx.reply(
                `/removebuyin @username <amount>\n\n` +
                `example:\n` +
                `/removebuyin @alex 50\n\n` +
                `note:\n` +
                `only room admins can remove buy-ins, and the amount is deducted from the player's current stack.`
            );
        }

        // parse username and amount
        let targetUsername: string;
        let amount: number;

        if (amountStr) {
            // format: @username amount
            targetUsername = usernameOrAmount.replace('@', '');
            amount = parseFloat(amountStr);
        } else {
            return ctx.reply(
                `❌ *Missing Amount*\n\n` +
                `Please specify both username and amount.\n\n` +
                `*Usage:* \`/removebuyin @username <amount>\`\n\n` +
                `*Example:* \`/removebuyin @john 50\``,
                { parse_mode: 'Markdown' }
            );
        }

        if (isNaN(amount) || amount <= 0) {
            return ctx.reply(
                `❌ *Invalid Amount*\n\n` +
                `The amount must be a positive number.\n\n` +
                `You entered: \`${amountStr}\``,
                { parse_mode: 'Markdown' }
            );
        }

        const userId = ctx.from!.id;

        // get active room for owner (prioritizes rooms with players and buyins)
        const roomId = await getActiveRoomForOwner(userId);

        if (!roomId) {
            return ctx.reply(
                `❌ *No Active Rooms*\n\n` +
                `You don't have any active rooms.\n\n` +
                `Create a room first with: \`/createroom\``,
                { parse_mode: 'Markdown' }
            );
        }

        // useCache = false to get fresh data for validation
        const room = await getRoom(roomId, false);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*`,
                { parse_mode: 'Markdown' }
            );
        }

        // check if room has joined players
        const joinedPlayers = room.players.filter(p => p.joined);
        if (joinedPlayers.length === 0) {
            return ctx.reply(
                `❌ *No Joined Players*\n\n` +
                `Room \`${roomId}\` has no joined players yet.\n\n` +
                `Players must join the room before you can remove buy-ins.`,
                { parse_mode: 'Markdown' }
            );
        }

        // check if target player exists and is joined
        const targetPlayer = room.players.find(p =>
            p.username.toLowerCase() === targetUsername.toLowerCase() && p.joined
        );

        if (!targetPlayer) {
            const playerList = joinedPlayers.map(p => `@${p.username}`).join(', ');
            return ctx.reply(
                `❌ *Player Not Found*\n\n` +
                `Player @${targetUsername} is not a joined member of this room.\n\n` +
                `*Joined Players:*\n${playerList}\n\n` +
                `💡 Make sure the player has joined the room first.`,
                { parse_mode: 'Markdown' }
            );
        }

        // check if player has any buy-in
        if (targetPlayer.buyIn === 0) {
            return ctx.reply(
                `❌ *No Buy-in to Remove*\n\n` +
                `@${targetPlayer.username} hasn't recorded any buy-ins yet.\n\n` +
                `Current buy-in: ₹0`,
                { parse_mode: 'Markdown' }
            );
        }

        // update buy-in for the target player
        const result = await updatePlayerBuyIn(roomId, targetPlayer.userId, targetPlayer.username, amount, 'remove');

        if (!result.success) {
            return ctx.reply(
                `❌ *Cannot Remove*\n\n` +
                `Cannot remove ₹${formatCurrency(amount)}.\n\n` +
                `@${targetPlayer.username}'s current buy-in is ₹${formatCurrency(targetPlayer.buyIn)}.\n\n` +
                `💡 You can only remove up to the player's current total!`,
                { parse_mode: 'Markdown' }
            );
        }

        ctx.reply(
            `✅ *Buy-in Removed!*\n\n` +
            `🎯 *Room:* \`${roomId}\`\n` +
            `👤 *Player:* @${targetPlayer.username}\n` +
            `💸 *Removed:* ₹${formatCurrency(amount)}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 *New Total:* ₹${formatCurrency(result.newTotal)}\n\n` +
            `💡 *Joined Players:* ${joinedPlayers.length}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)],
                    [Markup.button.callback('📊 Summary', `summary_${roomId}`)]
                ])
            }
        );
    });
};
