'use strict';

const { Events } = require('discord.js');
const { getVanityConfig } = require('../db');
const { hasVanity, applyVanity, removeVanity } = require('../utils/securityPanelHandler');

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence, client) {
        if (!newPresence || !newPresence.guild || !newPresence.member) return;

        const guild = newPresence.guild;
        const member = newPresence.member;
        if (member.user?.bot) return;

        try {
            const config = await getVanityConfig(guild.id).catch(() => null);
            if (!config || !config.is_enabled || !config.vanity_string) return;

            const wasMatch = oldPresence ? hasVanity(oldPresence, config.vanity_string) : false;
            const isMatch = hasVanity(newPresence, config.vanity_string);

            if (isMatch === wasMatch) return;

            if (isMatch && !wasMatch) {
                await applyVanity(guild, member, config, client);
            } else if (!isMatch && wasMatch) {
                await removeVanity(guild, member, config, client);
            }
        } catch (e) {
            console.error('[PresenceUpdate Vanity Error]:', e.message);
        }
    }
};
