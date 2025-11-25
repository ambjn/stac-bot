import { Context, Telegraf } from 'telegraf';
import { getRoom, addPlayer, getPlayerByUsername, getUserByUsername } from '../db';
import { parseCommandArgs, parseUsername } from '../utils/parse';

export const registerInvite = (bot: Telegraf<Context>) => {
    bot.command('invite', async (ctx) => {
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const args = parseCommandArgs(text);
        const [roomId, rawUser] = args;

        if (!roomId || !rawUser) {
            return ctx.reply('usage: /invite <roomId> @username');
        }

        const room = await getRoom(roomId);
        if (!room) {
            return ctx.reply('❌ room not found.');
        }

        // only owner can invite
        if (room.ownerId !== ctx.from!.id) {
            return ctx.reply('❌ only the room owner can invite players.');
        }

        const username = parseUsername(rawUser);

        // check if already invited
        const existing = await getPlayerByUsername(roomId, username);
        if (existing) {
            return ctx.reply(`ℹ️ @${username} is already invited to this room.`);
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
                    `🎯 you've been invited to join room ${roomId} by @${room.ownerUsername}!\n\n` +
                    `🔗 click here to join:\n${joinLink}\n\n` +
                    `or use: /join ${roomId}`
                );

                return ctx.reply(
                    `✅ invited @${username} to room ${roomId}\n\n` +
                    `📨 direct message sent to @${username}\n` +
                    `🔗 join link: ${joinLink}`
                );
            } catch (err) {
                // user might have blocked the bot or not started a conversation
                console.error('Failed to send direct message:', err);
                return ctx.reply(
                    `✅ invited @${username} to room ${roomId}\n\n` +
                    `⚠️ couldn't send direct message (user may need to start the bot first)\n` +
                    `🔗 share this link to join:\n${joinLink}`
                );
            }
        }

        // user not registered yet, just show the link
        ctx.reply(
            `✅ invited @${username} to room ${roomId}\n\n` +
            `🔗 share this link to join:\n${joinLink}`
        );
    });
};
