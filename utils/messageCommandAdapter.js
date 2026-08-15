const { MessageFlags } = require('discord.js');
const { getGuildPrefixes } = require('./prefixSystem');
const { buildWrongUsageContainer } = require('./commandUsageHelper');

// Per-guild prefix memory cache with 60s TTL for blazing fast message checking
const prefixCache = new Map();
const CACHE_TTL = 60000;

async function getCachedGuildPrefixes(guildId) {
    const cached = prefixCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.prefixes;
    }
    const prefixes = await getGuildPrefixes(guildId);
    prefixCache.set(guildId, { prefixes, timestamp: Date.now() });
    return prefixes;
}

function invalidatePrefixCache(guildId) {
    prefixCache.delete(guildId);
}

function createMessageInteractionAdapter(message, commandData, args, client) {
    let repliedMessage = null;
    let isDeferred = false;
    let isReplied = false;
    let isEphemeral = false;

    let subCommandName = null;

    if (commandData && commandData.options) {
        const subCommands = commandData.options.filter(opt => opt.type === 1); // Subcommands
        if (subCommands.length > 0 && args.length > 0) {
            const firstArg = args[0].toLowerCase();
            const matchedSub = subCommands.find(s => s.name.toLowerCase() === firstArg);
            if (matchedSub) {
                subCommandName = matchedSub.name;
                args = args.slice(1);
            }
        }
    }

    const adapter = {
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isChannelSelectMenu: () => false,
        isModalSubmit: () => false,
        isRepliable: () => true,

        guild: message.guild,
        guildId: message.guild.id,
        channel: message.channel,
        channelId: message.channel.id,
        user: message.author,
        member: message.member,
        client: client,
        commandName: commandData ? commandData.name : '',

        deferred: false,
        replied: false,

        deferReply: async (opts = {}) => {
            isDeferred = true;
            adapter.deferred = true;
            if (opts.ephemeral || opts.flags === MessageFlags.Ephemeral) {
                isEphemeral = true;
            } else {
                await message.channel.sendTyping().catch(() => {});
            }
            return true;
        },

        reply: async (payload) => {
            if (typeof payload === 'string') payload = { content: payload };
            const isPayloadEphemeral = isEphemeral || payload.ephemeral || payload.flags === MessageFlags.Ephemeral;

            if (isPayloadEphemeral) {
                // Delete user trigger message to keep channel clean
                message.delete().catch(() => {});

                // Send to user's DM first
                const dmMsg = await message.author.send(payload).catch(() => null);
                if (dmMsg) {
                    isReplied = true;
                    adapter.replied = true;
                    repliedMessage = dmMsg;
                    return dmMsg;
                }

                // If DM closed, send temporary auto-deleting message in channel
                repliedMessage = await message.channel.send(payload).catch(() => null);
                if (repliedMessage) {
                    setTimeout(() => repliedMessage.delete().catch(() => {}), 6000);
                }
                isReplied = true;
                adapter.replied = true;
                return repliedMessage;
            }

            repliedMessage = await message.reply(payload).catch(e => {
                return message.channel.send(payload).catch(() => {});
            });
            isReplied = true;
            adapter.replied = true;
            return repliedMessage;
        },

        editReply: async (payload) => {
            if (typeof payload === 'string') payload = { content: payload };
            const isPayloadEphemeral = isEphemeral || payload.ephemeral || payload.flags === MessageFlags.Ephemeral;

            if (isPayloadEphemeral) {
                message.delete().catch(() => {});
                if (repliedMessage) {
                    return await repliedMessage.edit(payload).catch(() => {});
                }
                const dmMsg = await message.author.send(payload).catch(() => null);
                if (dmMsg) {
                    repliedMessage = dmMsg;
                    isReplied = true;
                    adapter.replied = true;
                    return dmMsg;
                }
                repliedMessage = await message.channel.send(payload).catch(() => null);
                if (repliedMessage) {
                    setTimeout(() => repliedMessage.delete().catch(() => {}), 6000);
                }
                isReplied = true;
                adapter.replied = true;
                return repliedMessage;
            }

            if (repliedMessage) {
                return await repliedMessage.edit(payload).catch(e => {
                    return message.channel.send(payload).catch(() => {});
                });
            } else {
                repliedMessage = await message.reply(payload).catch(e => {
                    return message.channel.send(payload).catch(() => {});
                });
                isReplied = true;
                adapter.replied = true;
                return repliedMessage;
            }
        },

        followUp: async (payload) => {
            if (typeof payload === 'string') payload = { content: payload };
            const isPayloadEphemeral = isEphemeral || payload.ephemeral || payload.flags === MessageFlags.Ephemeral;

            if (isPayloadEphemeral) {
                const dmMsg = await message.author.send(payload).catch(() => null);
                if (dmMsg) return dmMsg;
                const tempMsg = await message.channel.send(payload).catch(() => null);
                if (tempMsg) setTimeout(() => tempMsg.delete().catch(() => {}), 6000);
                return tempMsg;
            }
            return await message.channel.send(payload).catch(() => {});
        },

        options: {
            getSubcommand: () => subCommandName,
            
            getUser: (name, required = false) => {
                if (message.mentions.users.size > 0) {
                    return message.mentions.users.first();
                }
                for (const arg of args) {
                    const idMatch = arg.match(/^<@!?(\d{17,20})>$/) || arg.match(/^(\d{17,20})$/);
                    if (idMatch) {
                        const user = client.users.cache.get(idMatch[1]);
                        if (user) return user;
                    }
                }
                return null;
            },

            getMember: (name, required = false) => {
                if (message.mentions.members && message.mentions.members.size > 0) {
                    return message.mentions.members.first();
                }
                for (const arg of args) {
                    const idMatch = arg.match(/^<@!?(\d{17,20})>$/) || arg.match(/^(\d{17,20})$/);
                    if (idMatch) {
                        const member = message.guild.members.cache.get(idMatch[1]);
                        if (member) return member;
                    }
                }
                return null;
            },

            getChannel: (name, required = false) => {
                if (message.mentions.channels.size > 0) {
                    return message.mentions.channels.first();
                }
                for (const arg of args) {
                    const idMatch = arg.match(/^<#(\d{17,20})>$/) || arg.match(/^(\d{17,20})$/);
                    if (idMatch) {
                        const chan = message.guild.channels.cache.get(idMatch[1]);
                        if (chan) return chan;
                    }
                }
                return null;
            },

            getRole: (name, required = false) => {
                if (message.mentions.roles.size > 0) {
                    return message.mentions.roles.first();
                }
                for (const arg of args) {
                    const idMatch = arg.match(/^<@&(\d{17,20})>$/) || arg.match(/^(\d{17,20})$/);
                    if (idMatch) {
                        const role = message.guild.roles.cache.get(idMatch[1]);
                        if (role) return role;
                    }
                }
                return null;
            },

            getString: (name, required = false) => {
                const nonMentions = args.filter(a => !a.startsWith('<@') && !a.startsWith('<#'));
                if (name === 'sebep' || name === 'not' || name === 'aciklama' || name === 'mesaj' || name === 'yazi') {
                    return nonMentions.join(' ') || (args.length > 0 ? args.join(' ') : null);
                }
                if (name === 'sure' || name === 'zaman') {
                    const durationArg = args.find(a => /^\d+[smhdgw]$/i.test(a));
                    if (durationArg) return durationArg;
                }
                return nonMentions.length > 0 ? nonMentions[0] : (args.length > 0 ? args[0] : null);
            },

            getInteger: (name, required = false) => {
                for (const arg of args) {
                    const parsed = parseInt(arg, 10);
                    if (!isNaN(parsed) && !arg.startsWith('<@') && !arg.startsWith('<#')) {
                        return parsed;
                    }
                }
                return null;
            },

            getBoolean: (name, required = false) => {
                for (const arg of args) {
                    const lower = arg.toLowerCase();
                    if (lower === 'true' || lower === 'evet' || lower === 'acik' || lower === '1') return true;
                    if (lower === 'false' || lower === 'hayir' || lower === 'kapali' || lower === '0') return false;
                }
                return null;
            }
        }
    };

    return adapter;
}

function checkRequiredOptions(commandData, args, message) {
    if (!commandData || !commandData.options) return { valid: true };

    const subcommands = commandData.options.filter(o => o.type === 1);
    if (subcommands.length > 0) {
        if (args.length === 0) {
            return {
                valid: false,
                reason: `Bir alt komut belirtmelisiniz (${subcommands.map(s => s.name).join(', ')}).`
            };
        }
        const subName = args[0].toLowerCase();
        const matchedSub = subcommands.find(s => s.name.toLowerCase() === subName);
        if (!matchedSub) {
            return {
                valid: false,
                reason: `Geçersiz alt komut: \`${subName}\`. Kullanılabilir alt komutlar: ${subcommands.map(s => s.name).join(', ')}`
            };
        }
        // Check sub-options
        if (matchedSub.options) {
            const reqSubOpts = matchedSub.options.filter(o => o.required);
            const remainingArgs = args.slice(1);
            if (reqSubOpts.length > 0 && remainingArgs.length === 0 && message.mentions.users.size === 0 && message.mentions.roles.size === 0) {
                return {
                    valid: false,
                    reason: `Eksik parametre: \`${reqSubOpts.map(o => o.name).join(', ')}\` belirtmelisiniz.`
                };
            }
        }
        return { valid: true };
    }

    const requiredOptions = commandData.options.filter(opt => opt.required);
    if (requiredOptions.length > 0) {
        const hasUserMention = message.mentions.users.size > 0;
        const hasRoleMention = message.mentions.roles.size > 0;
        const hasChannelMention = message.mentions.channels.size > 0;

        if (args.length === 0 && !hasUserMention && !hasRoleMention && !hasChannelMention) {
            return {
                valid: false,
                reason: `Eksik parametre: \`${requiredOptions.map(o => o.name).join(', ')}\` belirtmelisiniz.`
            };
        }
    }

    return { valid: true };
}

async function handleMessageCommand(message, client) {
    if (!message.guild || message.author.bot || !message.content) return false;

    const rawContent = message.content.trim();
    if (!rawContent) return false;

    // Fetch active prefixes for this specific guild
    const prefixesList = await getCachedGuildPrefixes(message.guild.id);
    if (!prefixesList || prefixesList.length === 0) return false;

    // Find if message starts with any active prefix
    let matchedPrefix = null;
    for (const p of prefixesList) {
        if (rawContent.startsWith(p.prefix)) {
            if (!matchedPrefix || p.prefix.length > matchedPrefix.length) {
                matchedPrefix = p.prefix;
            }
        }
    }

    if (!matchedPrefix) return false;

    // Extract command name and args
    const withoutPrefix = rawContent.slice(matchedPrefix.length).trim();
    if (!withoutPrefix) return false;

    const parts = withoutPrefix.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = client.commands.get(cmdName);
    if (!command) return false;

    // 1. Check required parameters
    const checkResult = checkRequiredOptions(command.data, args, message);
    if (!checkResult.valid) {
        const wrongUsagePayload = buildWrongUsageContainer(command.data, matchedPrefix, checkResult.reason);
        // Delete the triggering user command
        message.delete().catch(() => {});
        // Send ephemeral to DM first
        const dmMsg = await message.author.send(wrongUsagePayload).catch(() => null);
        if (!dmMsg) {
            // If DM closed, send temporary auto-deleting message
            const tempReply = await message.channel.send(wrongUsagePayload).catch(() => null);
            if (tempReply) {
                setTimeout(() => tempReply.delete().catch(() => {}), 6000);
            }
        }
        return true;
    }

    try {
        const fakeInteraction = createMessageInteractionAdapter(message, command.data, args, client);
        await command.execute(fakeInteraction, client);
        return true;
    } catch (err) {
        console.error(`[MessageCommand Error: ${cmdName}]`, err);
        const wrongUsagePayload = buildWrongUsageContainer(command.data, matchedPrefix, err.message || 'Komut yürütülürken beklenmeyen bir hata oluştu.');
        message.delete().catch(() => {});
        const dmMsg = await message.author.send(wrongUsagePayload).catch(() => null);
        if (!dmMsg) {
            const tempReply = await message.channel.send(wrongUsagePayload).catch(() => null);
            if (tempReply) {
                setTimeout(() => tempReply.delete().catch(() => {}), 6000);
            }
        }
        return true;
    }
}

module.exports = {
    handleMessageCommand,
    invalidatePrefixCache
};
