const { Events, ActivityType } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('../utils/uiBuilder');

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        if (!newPresence || !newPresence.guild || !newPresence.member) return;

        const guild = newPresence.guild;
        const member = newPresence.member;
        if (member.user.bot) return;

        try {
            const config = await db.getVanityConfig(guild.id).catch(() => null);
            if (!config || !config.is_enabled || !config.vanity_string || !config.role_id) return;

            const customActivity = newPresence.activities?.find(a => a.type === ActivityType.Custom);
            const statusText = customActivity?.state || '';

            const hasVanity = statusText.toLowerCase().includes(config.vanity_string.toLowerCase());
            const hasRole = member.roles.cache.has(config.role_id);

            const role = guild.roles.cache.get(config.role_id);
            if (!role) return;

            // 1. Durumuna yazıyı koyduysa ve rolü yoksa -> Rol Ver
            if (hasVanity && !hasRole) {
                await member.roles.add(role, `[Özel Durum Rolü] Durumuna "${config.vanity_string}" ekledi.`).catch(() => {});

                if (config.log_channel_id) {
                    const logChannel = guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const title = `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Özel Durum Rolü Verildi`;
                        const desc = `<@${member.id}> kullanıcısı durumuna \`${config.vanity_string}\` eklediği için ödül rolü verildi.`;
                        const fields = [
                            { name: 'Kullanıcı', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                            { name: 'Verilen Rol', value: `<@&${role.id}>`, inline: true },
                            { name: 'Mevcut Durum', value: `\`${statusText}\``, inline: false }
                        ];
                        const logMsg = createContainerMessage(title, desc, '#57F287', [], fields, false);
                        await logChannel.send(logMsg).catch(() => {});
                    }
                }
            }
            // 2. Durumundan yazıyı kaldırdıysa ve rolü varsa -> Rolü Al
            else if (!hasVanity && hasRole) {
                await member.roles.remove(role, `[Özel Durum Rolü] Durumundan "${config.vanity_string}" kaldırıldı.`).catch(() => {});

                if (config.log_channel_id) {
                    const logChannel = guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const title = `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Özel Durum Rolü Alındı`;
                        const desc = `<@${member.id}> kullanıcısı durumundan \`${config.vanity_string}\` kaldırdığı için ödül rolü geri alındı.`;
                        const fields = [
                            { name: 'Kullanıcı', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                            { name: 'Alınan Rol', value: `<@&${role.id}>`, inline: true }
                        ];
                        const logMsg = createContainerMessage(title, desc, '#ED4245', [], fields, false);
                        await logChannel.send(logMsg).catch(() => {});
                    }
                }
            }
        } catch (e) {
            console.error('[Vanity Role] Hata:', e);
        }
    }
};
