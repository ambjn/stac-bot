import { Telegraf, Markup, Context } from 'telegraf';
import { getRoom, getActiveRoomForOwner, updatePlayerCashOut } from '../db';
import { parseCommandArgs } from '../utils/parse';
import { formatCurrency } from '../utils/format';

export const registerCashOut = (bot: Telegraf<Context>) => {
    bot.command('cashout', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [usernameOrAmount, amountStr] = args;

        if (!usernameOrAmount) {
            return ctx.reply(
                `/cashout @username <amount>\n\n` +
                `example:\n` +
                `/cashout @alex 320\n\n` +
                `note:\n` +
                `this sets your final chip value - admins will use these values during settlement.`
            );
        }

        // parse username and amount
        let targetUsername: string;
        let amount: number;

        if (amountStr) {
            // format: @username amount
            targetUsername = usernameOrAmount.replace('@', '').replace('$', '');
            amount = parseFloat(amountStr.replace('$', ''));
        } else {
            return ctx.reply(
                `❌ *Missing Amount*\n\n` +
                `Please specify both username and amount.\n\n` +
                `*Usage:* \`/cashout @username <amount>\`\n\n` +
                `*Example:* \`/cashout @alex 320\``,
                { parse_mode: 'Markdown' }
            );
        }

        if (isNaN(amount) || amount < 0) {
            return ctx.reply(
                `❌ *Invalid Amount*\n\n` +
                `The amount must be a non-negative number.\n\n` +
                `You entered: \`${amountStr}\`\n\n` +
                `💡 Use 0 if the player lost all chips!`,
                { parse_mode: 'Markdown' }
            );
        }

        const userId = ctx.from!.id;

        // get active room for owner (admin only)
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

        if (room.settled) {
            return ctx.reply(
                `⚠️ *Room Already Settled*\n\n` +
                `This room has already been settled.\n\n` +
                `You cannot modify cashouts after settlement.`,
                { parse_mode: 'Markdown' }
            );
        }

        // check if room has joined players
        const joinedPlayers = room.players.filter(p => p.joined);
        if (joinedPlayers.length === 0) {
            return ctx.reply(
                `❌ *No Joined Players*\n\n` +
                `Room \`${roomId}\` has no joined players yet.`,
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
                `*Joined Players:*\n${playerList}`,
                { parse_mode: 'Markdown' }
            );
        }

        // update cash out for the target player
        const result = await updatePlayerCashOut(roomId, targetPlayer.userId, targetPlayer.username, amount);

        if (!result.success) {
            return ctx.reply(
                `❌ *Error*\n\n${result.error}`,
                { parse_mode: 'Markdown' }
            );
        }

        const pnl = amount - targetPlayer.buyIn;
        const pnlStr = pnl >= 0 ? `+₹${formatCurrency(pnl)}` : `-₹${formatCurrency(Math.abs(pnl))}`;
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';
        const resultEmoji = pnl > 0 ? '🎉' : pnl < 0 ? '😔' : '🤝';

        ctx.reply(
            `${resultEmoji} *Cashout Recorded!*\n\n` +
            `🎯 *Room:* \`${roomId}\`\n` +
            `👤 *Player:* @${targetPlayer.username}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💵 *Buy-in:* ₹${formatCurrency(targetPlayer.buyIn)}\n` +
            `💰 *Cashout:* ₹${formatCurrency(amount)}\n\n` +
            `${pnlEmoji} *P&L:* ${pnlStr}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💡 Once all players record their cashouts, you can settle the room!`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 View Summary', `summary_${roomId}`)],
                    [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
                ])
            }
        );
    });
};
