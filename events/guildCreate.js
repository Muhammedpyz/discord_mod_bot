const { Events, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { COLORS, createContainerMessage } = require('../utils/uiBuilder');
const config = require('../config.json');

async function handleUnauthorizedGuild(guild) {
    if ((process.env.ALLOWED_GUILDS ? process.env.ALLOWED_GUILDS.split(',') : []).includes(guild.id)) return;

    const payload = createContainerMessage(
        'Yetkisiz Sunucu!',
        `Bu bot bu sunucuda çalışmaya yetkili değildir.\n\nEğer siz de böyle bir bota sahip olmak isterseniz sahibim **muhammedpyz_** (**muhammedpyz_**) ile iletişime geçebilirsiniz.`,
        COLORS.ERROR
    );

    const channels = guild.channels.cache.filter(c => 
        c.type === ChannelType.GuildText && 
        c.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
    );

    for (const channel of channels.values()) {
        try {
            await channel.send(payload);
            console.log(`[Yetkisiz Sunucu Bildirimi] ${guild.name} -> #${channel.name} kanalına gönderildi.`);
        } catch (err) {
            // Ignore channel send errors
        }
    }
}

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        await handleUnauthorizedGuild(guild);
    },
    handleUnauthorizedGuild
};
