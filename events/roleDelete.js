const { Events } = require('discord.js');
const {
    pool,
    getGuildConfig,
    updateGuildConfigCache,
    getAutoModConfig,
    updateAutoModConfigCache
} = require('../db');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        if (!role.guild || !role.id) return;
        const guildId = role.guild.id;
        const roleId = role.id;

        let conn;
        try {
            conn = await pool.getConnection();

            // 1. Guild Config Rolleri (Otorol, Uyarı 1, Uyarı 2, Cezalı/Banlı, Metin Mute, Ses Mute)
            const gConfig = await getGuildConfig(guildId);
            if (gConfig) {
                let gUpdated = false;
                if (gConfig.autorole_id === roleId) { gConfig.autorole_id = null; gUpdated = true; }
                if (gConfig.warn1_role_id === roleId) { gConfig.warn1_role_id = null; gUpdated = true; }
                if (gConfig.warn2_role_id === roleId) { gConfig.warn2_role_id = null; gUpdated = true; }
                if (gConfig.banned_role_id === roleId) { gConfig.banned_role_id = null; gUpdated = true; }
                if (gConfig.text_mute_role_id === roleId) { gConfig.text_mute_role_id = null; gUpdated = true; }
                if (gConfig.voice_mute_role_id === roleId) { gConfig.voice_mute_role_id = null; gUpdated = true; }

                if (gUpdated) {
                    await conn.query(
                        `UPDATE guild_config SET
                            autorole_id = ?, warn1_role_id = ?,
                            warn2_role_id = ?, banned_role_id = ?,
                            text_mute_role_id = ?, voice_mute_role_id = ?
                         WHERE guild_id = ?`,
                        [
                            gConfig.autorole_id, gConfig.warn1_role_id,
                            gConfig.warn2_role_id, gConfig.banned_role_id,
                            gConfig.text_mute_role_id, gConfig.voice_mute_role_id,
                            guildId
                        ]
                    );
                    updateGuildConfigCache(guildId, gConfig);
                }
            }

            // 2. AutoMod Muafiyet Rolleri
            const amConfig = await getAutoModConfig(guildId);
            if (amConfig && amConfig.exempt_roles) {
                let exRolesArr = typeof amConfig.exempt_roles === 'string' ? JSON.parse(amConfig.exempt_roles) : amConfig.exempt_roles;
                if (Array.isArray(exRolesArr) && exRolesArr.includes(roleId)) {
                    exRolesArr = exRolesArr.filter(id => id !== roleId);
                    amConfig.exempt_roles = exRolesArr;
                    await conn.query('UPDATE automod_config SET exempt_roles = ? WHERE guild_id = ?', [JSON.stringify(exRolesArr), guildId]);
                    updateAutoModConfigCache(guildId, amConfig);
                }
            }

            // 3. Tag Role
            await conn.query('DELETE FROM tag_role WHERE guild_id = ? AND role_id = ?', [guildId, roleId]);

        } catch (err) {
            console.error('[RoleDelete Sync Error]:', err);
        } finally {
            if (conn) conn.release();
        }
    }
};
