const { Events, AuditLogEvent } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { createV2Message, createContainerMessage } = require('../utils/uiBuilder');
const { pool } = require('../db');

const nukeBanCache = new Map();

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        if (!ban.guild) return;

        let isAntiNukeEnabled = true;
        let dbLogChannelId = null;

        let conn;
        try {
            conn = await pool.getConnection();
            const config = await conn.query('SELECT log_channel_id, anti_raid_enabled FROM guild_config WHERE guild_id = ?', [ban.guild.id]);
            if (config.length > 0) {
                dbLogChannelId = config[0].log_channel_id;
                isAntiNukeEnabled = config[0].anti_raid_enabled;
            }
        } catch (err) {
            console.error("GuildBanAdd DB error:", err);
            return;
        } finally {
            if (conn) conn.release();
        }

        if (!isAntiNukeEnabled) return;

        try {
            const fetchedLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            });

            const banLog = fetchedLogs.entries.first();
            if (!banLog) return;

            const { executor, target } = banLog;
            
            if (target.id !== ban.user.id) return;
            if (executor.id === client.user.id || executor.id === ban.guild.ownerId) return;

            const now = Date.now();
            const cacheKey = `${ban.guild.id}_${executor.id}_banAdds`;
            
            if (!nukeBanCache.has(cacheKey)) {
                nukeBanCache.set(cacheKey, []);
            }

            const timestamps = nukeBanCache.get(cacheKey);
            const recentBans = timestamps.filter(t => now - t < 30000);
            recentBans.push(now);
            nukeBanCache.set(cacheKey, recentBans);

            if (recentBans.length >= 5) {
                const member = await ban.guild.members.fetch(executor.id).catch(() => null);
                if (member && member.manageable) {
                    const rolesToKeep = member.roles.cache.filter(role => role.name === '@everyone');
                    await member.roles.set(rolesToKeep, 'Sistem Koruması: Şüpheli toplu yasaklama işlemi tespit edildi.').catch(()=>{});
                    
                    if (dbLogChannelId) {
                        const logChannel = ban.guild.channels.cache.get(dbLogChannelId);
                        if (logChannel) {
                            const payload = createV2Message({
                                title: 'Sistem Koruması Tetiklendi',
                                color: COLORS.ERROR,
                                fields: [
                                    { name: 'Kullanıcı', value: `${executor.tag} (${executor.id})` },
                                    { name: 'Yetkili', value: 'Sistem Kontrolü' },
                                    { name: 'Sebep', value: 'Kısa sürede çok fazla kullanıcıyı yasakladığı için tüm yetkileri askıya alındı.' }
                                ]
                            });
                            logChannel.send(payload).catch(() => {});
                        }
                    }
                }
                nukeBanCache.delete(cacheKey);
            }

        } catch (error) {
            console.error("Sistem Koruma Yasaklama Kontrolü Hatası:", error);
        }
    }
};
