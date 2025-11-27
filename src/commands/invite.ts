import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, addPlayer, getPlayerByUsername, getUserByUsername } from '../db';
import { parseCommandArgs, parseUsername } from '../utils/parse';

export const registerInvite = (bot: Telegraf<Context>) => {
    bot.command('invite', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, ...rawUsers] = args;

        if (!roomId || rawUsers.length === 0) {
            return ctx.reply(
                `📨 *Invite Players*\n\n` +
                `*Usage:*\n` +
                `\`/invite <roomId> @username1 @username2 ...\`\n\n` +
                `*Single invite:*\n` +
                `\`/invite abc123 @alice\`\n\n` +
                `*Multiple invites:*\n` +
                `\`/invite abc123 @alice @bob @charlie\`\n` +
                `\`/invite abc123 @alice, @bob, @charlie\`\n\n` +
                `💡 You can invite multiple players at once!`,
                { parse_mode: 'Markdown' }
            );
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${roomId}\` doesn't exist.\n\n` +
                `Use \`/myrooms\` to see your rooms.`,
                { parse_mode: 'Markdown' }
            );
        }

        // only owner can invite
        if (room.ownerId !== ctx.from!.id) {
            return ctx.reply(
                `🚫 *Permission Denied*\n\n` +
                `Only the room owner can invite players.\n\n` +
                `👑 Owner: @${room.ownerUsername}`,
                { parse_mode: 'Markdown' }
            );
        }

        // Parse all usernames (handle comma-separated or space-separated)
        const allUsers = rawUsers.join(' ').split(/[,\s]+/).filter(u => u.trim());
        const usernames = allUsers.map(u => parseUsername(u)).filter(u => u);

        if (usernames.length === 0) {
            return ctx.reply(
                `❌ *No Valid Usernames*\n\n` +
                `Please provide at least one valid username.\n\n` +
                `*Example:*\n` +
                `\`/invite ${roomId} @alice @bob\``,
                { parse_mode: 'Markdown' }
            );
        }

        // Get bot username for deep link
        const botInfo = await ctx.telegram.getMe();
        const joinLink = `https://t.me/${botInfo.username}?start=join_${roomId}`;

        // Track results
        const invited: string[] = [];
        const alreadyInvited: string[] = [];
        const dmSent: string[] = [];
        const dmFailed: string[] = [];

        // Process each username
        for (const username of usernames) {
            // Check if already invited
            const existing = await getPlayerByUsername(roomId, username);
            if (existing) {
                alreadyInvited.push(username);
                continue;
            }

            // Add player to room
            await addPlayer(roomId, {
                userId: 0, // will be set when they join
                username,
                buyIn: 0,
                joined: false
            });

            invited.push(username);

            // Try to send DM if user is registered
            const registeredUser = await getUserByUsername(username);
            if (registeredUser) {
                try {
                    await ctx.telegram.sendMessage(
                        registeredUser.userId,
                        `🎯 *You're Invited!*\n\n` +
                        `@${room.ownerUsername} invited you to join their poker game!\n\n` +
                        `🎲 *Room:* \`${roomId}\`\n\n` +
                        `Click the button below to join the game!`,
                        {
                            parse_mode: 'Markdown',
                            ...Markup.inlineKeyboard([
                                [Markup.button.url('🎯 Join Room', joinLink)],
                                [Markup.button.callback('❓ What is STAC?', 'what_is_stac')]
                            ])
                        }
                    );
                    dmSent.push(username);
                } catch (err) {
                    console.error(`Failed to send DM to @${username}:`, err);
                    dmFailed.push(username);
                }
            }
        }

        // Build response message
        let response = `📨 *Invitation Summary*\n\n🎯 *Room:* \`${roomId}\`\n\n━━━━━━━━━━━━━━━━━━\n\n`;

        if (invited.length > 0) {
            response += `✅ *Invited (${invited.length})*\n`;
            invited.forEach(u => response += `   • @${u}\n`);
            response += `\n`;
        }

        if (dmSent.length > 0) {
            response += `📨 *DM Sent (${dmSent.length})*\n`;
            dmSent.forEach(u => response += `   • @${u}\n`);
            response += `\n`;
        }

        if (dmFailed.length > 0) {
            response += `⚠️ *DM Failed (${dmFailed.length})*\n`;
            dmFailed.forEach(u => response += `   • @${u}\n`);
            response += `\n`;
        }

        if (alreadyInvited.length > 0) {
            response += `ℹ️ *Already Invited (${alreadyInvited.length})*\n`;
            alreadyInvited.forEach(u => response += `   • @${u}\n`);
            response += `\n`;
        }

        response += `━━━━━━━━━━━━━━━━━━\n\n`;

        if (invited.length > 0) {
            response += `🔗 *Share this link:*\n${joinLink}\n\n`;
            response += `💡 Players can also join using: \`/join ${roomId}\``;
        } else if (alreadyInvited.length === usernames.length) {
            response += `💡 All users were already invited to this room!`;
        }

        ctx.reply(response, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.url('🔗 Join Link', joinLink)],
                [Markup.button.callback('👥 Invite More', `invite_more_${roomId}`)],
                [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
            ])
        });
    });

    // Callback handlers
    bot.action(/invite_more_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `👥 *Invite More Players*\n\n` +
            `*Single invite:*\n` +
            `\`/invite ${roomId} @username\`\n\n` +
            `*Multiple invites:*\n` +
            `\`/invite ${roomId} @alice @bob @charlie\`\n` +
            `\`/invite ${roomId} @alice, @bob, @charlie\``,
            { parse_mode: 'Markdown' }
        );
    });

    bot.action('what_is_stac', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            `🎯 *What is STAC?*\n\n` +
            `STAC is your Smart Settlement Tool for poker games!\n\n` +
            `✨ *Features:*\n` +
            `• Track buy-ins and cashouts\n` +
            `• Automatic settlement calculations\n` +
            `• Crypto payments via Solana\n` +
            `• Simple and transparent\n\n` +
            `Ready to play? Accept the invitation above!`,
            { parse_mode: 'Markdown' }
        );
    });
};
