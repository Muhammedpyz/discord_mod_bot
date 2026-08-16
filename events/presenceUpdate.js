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
            }
            // 2. Durumundan yazıyı kaldırdıysa ve rolü varsa -> Rolü Al
            else if (!hasVanity && hasRole) {
                await member.roles.remove(role, `[Özel Durum Rolü] Durumundan "${config.vanity_string}" kaldırıldı.`).catch(() => {});
            }
        } catch (e) {
            console.error('[Vanity Role] Hata:', e);
        }
    }
};
