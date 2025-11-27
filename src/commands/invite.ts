import { Context, Telegraf, Markup } from 'telegraf';
import { getRoom, addPlayer, getPlayerByUsername, getUserByUsername } from '../db';
import { parseCommandArgs, parseUsername } from '../utils/parse';

export const registerInvite = (bot: Telegraf<Context>) => {
    bot.command('invite', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, rawUser] = args;

        if (!roomId || !rawUser) {
            return ctx.reply(
                `📨 *Invite Players*\n\n` +
                `*Usage:*\n` +
                `\`/invite <roomId> @username\`\n\n` +
                `*Example:*\n` +
                `\`/invite abc123 @alice\`\n\n` +
                `💡 You can invite multiple players by running the command multiple times!`,
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

        const username = parseUsername(rawUser);

        // check if already invited
        const existing = await getPlayerByUsername(roomId, username);
        if (existing) {
            return ctx.reply(
                `ℹ️ *Already Invited*\n\n` +
                `@${username} is already invited to this room.\n\n` +
                `${existing.joined ? '✅ They have joined!' : '⏳ Waiting for them to join...'}`,
                { parse_mode: 'Markdown' }
            );
        }

        await addPlayer(roomId, {
            userId: 0, // will be set when they join
            username,
            buyIn: 0,
            joined: false
        });

        // get bot username for deep link
        const botInfo = await ctx.telegram.getMe();
        const joinLink = `https://t.me/${botInfo.username}?start=join_${roomId}`;

        // check if invited user is already registered
        const registeredUser = await getUserByUsername(username);

        if (registeredUser) {
            // send direct message to the registered user
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

                return ctx.reply(
                    `✅ *Invitation Sent!*\n\n` +
                    `👤 *Player:* @${username}\n` +
                    `🎯 *Room:* \`${roomId}\`\n\n` +
                    `📨 Direct message sent successfully!\n\n` +
                    `💡 They can also join using: \`/join ${roomId}\``,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('👥 Invite More', `invite_more_${roomId}`)],
                            [Markup.button.callback('🎯 View Room', `view_room_${roomId}`)]
                        ])
                    }
                );
            } catch (err) {
                // user might have blocked the bot or not started a conversation
                console.error('Failed to send direct message:', err);
                return ctx.reply(
                    `✅ *Player Invited!*\n\n` +
                    `👤 *Player:* @${username}\n` +
                    `🎯 *Room:* \`${roomId}\`\n\n` +
                    `⚠️ *Note:* Couldn't send direct message.\n` +
                    `The user may need to start the bot first.\n\n` +
                    `📤 Share this link with them:`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.url('🔗 Join Link', joinLink)],
                            [Markup.button.callback('👥 Invite More', `invite_more_${roomId}`)]
                        ])
                    }
                );
            }
        }

        // user not registered yet, just show the link
        ctx.reply(
            `✅ *Player Invited!*\n\n` +
            `👤 *Player:* @${username}\n` +
            `🎯 *Room:* \`${roomId}\`\n\n` +
            `📤 Share this link with them to join:`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('🔗 Join Link', joinLink)],
                    [Markup.button.callback('👥 Invite More', `invite_more_${roomId}`)]
                ])
            }
        );
    });

    // Callback handlers
    bot.action(/invite_more_(.+)/, async (ctx) => {
        const roomId = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.reply(
            `👥 *Invite More Players*\n\n` +
            `Use: \`/invite ${roomId} @username\`\n\n` +
            `*Example:*\n` +
            `\`/invite ${roomId} @bob\``,
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
