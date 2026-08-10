const { Events } = require('discord.js');
const { pool, getGuildConfig } = require('../db');
const { sendLog } = require('../utils/logger');
const { createV2Message, COLORS } = require('../utils/uiBuilder');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        if (!newMember.guild) return;

        let config;
        try {
            config = await getGuildConfig(newMember.guild.id);
        } catch (e) {
            console.error("Config hatası guildMemberUpdate:", e);
            return;
        }

        if (!config) return;
        const guildId = newMember.guild.id;
        const userId = newMember.id;

        let conn;
        try {
            conn = await pool.getConnection();

            // 1. Manuel Timeout Kaldırma Tespiti
            const oldTimeout = oldMember.isCommunicationDisabled();
            const newTimeout = newMember.isCommunicationDisabled();
            if (oldTimeout && !newTimeout) {
                // Timeout kalkmış. Veritabanında aktif Mute var mı bakalım.
                const [rows] = await conn.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                if (rows.length > 0) {
                    await conn.query('UPDATE mutes SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                    if (config.log_channel_id) {
                        const payload = createV2Message({
                            title: 'Manuel Ceza Kaldırma (Timeout)',
                            description: `**Kullanıcı:** ${newMember.user.tag} (<@${userId}>)\nKullanıcının Discord üzerindeki zaman aşımı cezası (timeout) bir yetkili tarafından manuel kaldırıldı. Veritabanındaki susturma (mute) kaydı eşzamanlı olarak silindi.`,
                            color: COLORS.LOG
                        });
                        await sendLog(newMember.guild, payload, 'system').catch(()=>{});
                    }
                }
            }

            // 2. Manuel Mute Rolü Kaldırma Tespiti
            const checkRolesRemoved = async (roleId, roleTypeDesc) => {
                if (!roleId) return;
                const hadRole = oldMember.roles.cache.has(roleId);
                const hasRole = newMember.roles.cache.has(roleId);
                
                if (hadRole && !hasRole) {
                    const [rows] = await conn.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                    if (rows.length > 0) {
                        await conn.query('UPDATE mutes SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                        if (config.log_channel_id) {
                            const payload = createV2Message({
                                title: 'Manuel Ceza Kaldırma (Mute Rolü)',
                                description: `**Kullanıcı:** ${newMember.user.tag} (<@${userId}>)\nKullanıcının üzerindeki **${roleTypeDesc}** yetkililer tarafından manuel olarak alındı. Veritabanındaki aktif susturma kaydı silindi.`,
                                color: COLORS.LOG
                            });
                            await sendLog(newMember.guild, payload, 'system').catch(()=>{});
                        }
                    }
                }
            };

            await checkRolesRemoved(config.text_mute_role_id, 'Metin Susturma Rolü');
            await checkRolesRemoved(config.voice_mute_role_id, 'Ses Susturma Rolü');

            // 3. Manuel Uyarı/Ban Rolü Kaldırma Tespiti
            const checkWarnRoleRemoved = async (roleId, roleDesc) => {
                if (!roleId) return;
                const hadRole = oldMember.roles.cache.has(roleId);
                const hasRole = newMember.roles.cache.has(roleId);
                if (hadRole && !hasRole) {
                    const [warnRows] = await conn.query('SELECT id FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                    if (warnRows.length > 0) {
                        // Eğer manuel uyarı rolü sildiyse uyarıları pasife çek!
                        await conn.query('UPDATE warnings SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                        if (config.log_channel_id) {
                            const payload = createV2Message({
                                title: 'Manuel Ceza Kaldırma (Uyarı Rolü)',
                                description: `**Kullanıcı:** ${newMember.user.tag} (<@${userId}>)\nKullanıcının üzerindeki **${roleDesc}** yetkililer tarafından manuel olarak alındı. Kullanıcının sistemdeki tüm aktif uyarıları temizlendi.`,
                                color: COLORS.LOG
                            });
                            await sendLog(newMember.guild, payload, 'system').catch(()=>{});
                        }
                    }
                }
            };

            await checkWarnRoleRemoved(config.warn1_role_id, '1. Uyarı Rolü');
            await checkWarnRoleRemoved(config.warn2_role_id, '2. Uyarı Rolü');
            await checkWarnRoleRemoved(config.banned_role_id, 'Yasaklı (Banned) Rolü');

        } catch (err) {
            console.error("guildMemberUpdate hatası:", err);
        } finally {
            if (conn) conn.release();
        }
    }
};
