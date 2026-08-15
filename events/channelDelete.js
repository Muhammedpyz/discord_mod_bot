const { Events } = require('discord.js');
const {
    pool,
    getGuildConfig,
    updateGuildConfigCache,
    getWelcomeConfig,
    updateWelcomeConfigCache,
    getAutoModConfig,
    updateAutoModConfigCache,
    getGuildSetup,
    updateGuildSetupCache
} = require('../db');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild || !channel.id) return;
        const guildId = channel.guild.id;
        const channelId = channel.id;

        let conn;
        try {
            conn = await pool.getConnection();

            // 1. Tickets Takibi
            const rows = await conn.query('SELECT * FROM tickets WHERE channel_id = ? AND status = "open"', [channelId]);
            if (rows.length > 0) {
                await conn.query(
                    'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE channel_id = ? AND status = "open"',
                    [channelId]
                );
            }

            // 2. Karşılama (Welcome/Goodbye) Kanalları
            const welcomeCfg = await getWelcomeConfig(guildId);
            if (welcomeCfg) {
                let updated = false;
                if (welcomeCfg.welcome_channel_id === channelId) {
                    welcomeCfg.welcome_channel_id = null;
                    await conn.query('UPDATE welcome_config SET welcome_channel_id = NULL WHERE guild_id = ?', [guildId]);
                    updated = true;
                }
                if (welcomeCfg.goodbye_channel_id === channelId) {
                    welcomeCfg.goodbye_channel_id = null;
                    await conn.query('UPDATE welcome_config SET goodbye_channel_id = NULL WHERE guild_id = ?', [guildId]);
                    updated = true;
                }
                if (updated) updateWelcomeConfigCache(guildId, welcomeCfg);
            }

            // 3. Guild Config Kanalları (Log, Welcome, Goodbye, Counting, Suggestion)
            const gConfig = await getGuildConfig(guildId);
            if (gConfig) {
                let gUpdated = false;
                if (gConfig.welcome_channel_id === channelId) { gConfig.welcome_channel_id = null; gUpdated = true; }
                if (gConfig.goodbye_channel_id === channelId) { gConfig.goodbye_channel_id = null; gUpdated = true; }
                if (gConfig.log_channel_id === channelId) { gConfig.log_channel_id = null; gUpdated = true; }
                if (gConfig.log_voice_channel_id === channelId) { gConfig.log_voice_channel_id = null; gUpdated = true; }
                if (gConfig.log_ticket_channel_id === channelId) { gConfig.log_ticket_channel_id = null; gUpdated = true; }
                if (gConfig.log_system_channel_id === channelId) { gConfig.log_system_channel_id = null; gUpdated = true; }
                if (gConfig.counting_channel_id === channelId) { gConfig.counting_channel_id = null; gUpdated = true; }
                if (gConfig.suggestion_channel_id === channelId) { gConfig.suggestion_channel_id = null; gUpdated = true; }

                if (gUpdated) {
                    await conn.query(
                        `UPDATE guild_config SET
                            welcome_channel_id = ?, goodbye_channel_id = ?,
                            log_channel_id = ?, log_voice_channel_id = ?,
                            log_ticket_channel_id = ?, log_system_channel_id = ?,
                            counting_channel_id = ?, suggestion_channel_id = ?
                         WHERE guild_id = ?`,
                        [
                            gConfig.welcome_channel_id, gConfig.goodbye_channel_id,
                            gConfig.log_channel_id, gConfig.log_voice_channel_id,
                            gConfig.log_ticket_channel_id, gConfig.log_system_channel_id,
                            gConfig.counting_channel_id, gConfig.suggestion_channel_id,
                            guildId
                        ]
                    );
                    updateGuildConfigCache(guildId, gConfig);
                }
            }

            // 4. AutoMod Medya ve Muafiyet Kanalları
            const amConfig = await getAutoModConfig(guildId);
            if (amConfig) {
                let amUpdated = false;
                if (amConfig.media_channels) {
                    let mediaArr = typeof amConfig.media_channels === 'string' ? JSON.parse(amConfig.media_channels) : amConfig.media_channels;
                    if (Array.isArray(mediaArr) && mediaArr.includes(channelId)) {
                        mediaArr = mediaArr.filter(id => id !== channelId);
                        amConfig.media_channels = mediaArr;
                        await conn.query('UPDATE automod_config SET media_channels = ? WHERE guild_id = ?', [JSON.stringify(mediaArr), guildId]);
                        amUpdated = true;
                    }
                }
                if (amConfig.exempt_channels) {
                    let exChArr = typeof amConfig.exempt_channels === 'string' ? JSON.parse(amConfig.exempt_channels) : amConfig.exempt_channels;
                    if (Array.isArray(exChArr) && exChArr.includes(channelId)) {
                        exChArr = exChArr.filter(id => id !== channelId);
                        amConfig.exempt_channels = exChArr;
                        await conn.query('UPDATE automod_config SET exempt_channels = ? WHERE guild_id = ?', [JSON.stringify(exChArr), guildId]);
                        amUpdated = true;
                    }
                }
                if (amUpdated) updateAutoModConfigCache(guildId, amConfig);
            }

            // 5. Özel Odalar (Private Rooms) Setup & Active Rooms
            const roomSetup = await getGuildSetup(guildId);
            if (roomSetup) {
                let rUpdated = false;
                if (roomSetup.setup_channel_id === channelId) { roomSetup.setup_channel_id = null; rUpdated = true; }
                if (roomSetup.setup_voice_channel_id === channelId) { roomSetup.setup_voice_channel_id = null; rUpdated = true; }
                if (roomSetup.active_rooms_category_id === channelId) { roomSetup.active_rooms_category_id = null; rUpdated = true; }
                if (roomSetup.log_channel_id === channelId) { roomSetup.log_channel_id = null; rUpdated = true; }

                if (rUpdated) {
                    await conn.query(
                        `UPDATE guild_setup SET
                            setup_channel_id = ?, setup_voice_channel_id = ?,
                            active_rooms_category_id = ?, log_channel_id = ?
                         WHERE guild_id = ?`,
                        [
                            roomSetup.setup_channel_id, roomSetup.setup_voice_channel_id,
                            roomSetup.active_rooms_category_id, roomSetup.log_channel_id,
                            guildId
                        ]
                    );
                    updateGuildSetupCache(guildId, roomSetup);
                }
            }

            // Aktif özel oda ise tablodan temizle
            await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [channelId]);

        } catch (err) {
            console.error('[ChannelDelete Sync Error]:', err);
        } finally {
            if (conn) conn.release();
        }
    }
};
