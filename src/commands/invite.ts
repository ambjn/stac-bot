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
                `/invite <roomId> @username, @username, @username\n\n` +
                `example:\n` +
                `/invite abc123 @alex, @maria, @tom\n\n` +
                `note:\n` +
                `you can invite multiple users at once by separating their usernames with a comma.`
            );
        }

        const room = await getRoom(roomId);
        if (!room) {
            const escapeMarkdown = (text: string) => {
                return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
            };
            return ctx.reply(
                `❌ *Room Not Found*\n\n` +
                `Room \`${escapeMarkdown(roomId)}\` doesn't exist\\.\n\n` +
                `Use \`/myrooms\` to see your rooms\\.`,
                { parse_mode: 'MarkdownV2' }
            );
        }

        // only owner can invite
        if (room.ownerId !== ctx.from!.id) {
            const escapeMarkdown = (text: string) => {
                return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
            };
            return ctx.reply(
                `🚫 *Permission Denied*\n\n` +
                `Only the room owner can invite players\\.\n\n` +
                `👑 Owner: @${escapeMarkdown(room.ownerUsername)}`,
                { parse_mode: 'MarkdownV2' }
            );
        }

        // Parse all usernames (handle comma-separated or space-separated)
        const allUsers = rawUsers.join(' ').split(/[,\s]+/).filter(u => u.trim());
        const usernames = allUsers.map(u => parseUsername(u)).filter(u => u);

        if (usernames.length === 0) {
            const escapeMarkdown = (text: string) => {
                return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
            };
            return ctx.reply(
                `❌ *No Valid Usernames*\n\n` +
                `Please provide at least one valid username\\.\n\n` +
                `*Example:*\n` +
                `\`/invite ${escapeMarkdown(roomId)} @alice @bob\``,
                { parse_mode: 'MarkdownV2' }
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
                    const escapeMarkdown = (text: string) => {
                        return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
                    };
                    await ctx.telegram.sendMessage(
                        registeredUser.userId,
                        `🎯 *You're Invited\\!*\n\n` +
                        `@${escapeMarkdown(room.ownerUsername)} invited you to join their poker game\\!\n\n` +
                        `🎲 *Room:* \`${escapeMarkdown(roomId)}\`\n\n` +
                        `Use \`/join ${escapeMarkdown(roomId)}\` to join the game\\!`,
                        {
                            parse_mode: 'MarkdownV2'
                        }
                    );
                    dmSent.push(username);
                } catch (err) {
                    console.error(`Failed to send DM to @${username}:`, err);
                    dmFailed.push(username);
                }
            }
        }

        // Build response message (using MarkdownV2 with proper escaping)
        const escapeMarkdown = (text: string) => {
            return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
        };

        let response = `📨 *Invitation Summary*\n\n🎯 *Room:* \`${escapeMarkdown(roomId)}\`\n\n━━━━━━━━━━━━━━━━━━\n\n`;

        if (invited.length > 0) {
            response += `✅ *Invited \\(${invited.length}\\)*\n`;
            invited.forEach(u => response += `   • @${escapeMarkdown(u)}\n`);
            response += `\n`;
        }

        if (dmSent.length > 0) {
            response += `📨 *DM Sent \\(${dmSent.length}\\)*\n`;
            dmSent.forEach(u => response += `   • @${escapeMarkdown(u)}\n`);
            response += `\n`;
        }

        if (dmFailed.length > 0) {
            response += `⚠️ *DM Failed \\(${dmFailed.length}\\)*\n`;
            dmFailed.forEach(u => response += `   • @${escapeMarkdown(u)}\n`);
            response += `\n`;
        }

        if (alreadyInvited.length > 0) {
            response += `ℹ️ *Already Invited \\(${alreadyInvited.length}\\)*\n`;
            alreadyInvited.forEach(u => response += `   • @${escapeMarkdown(u)}\n`);
            response += `\n`;
        }

        response += `━━━━━━━━━━━━━━━━━━\n\n`;

        if (invited.length > 0) {
            response += `🔗 *Share this link:*\n${escapeMarkdown(joinLink)}\n\n`;
            response += `💡 Players can also join using: \`/join ${escapeMarkdown(roomId)}\``;
        } else if (alreadyInvited.length === usernames.length) {
            response += `💡 All users were already invited to this room\\!`;
        }

        ctx.reply(response, {
            parse_mode: 'MarkdownV2',
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
            `/invite <roomId> @username, @username, @username\n\n` +
            `example:\n` +
            `/invite ${roomId} @alex, @maria, @tom\n\n` +
            `note:\n` +
            `you can invite multiple users at once by separating their usernames with a comma.`
        );
    });
};
