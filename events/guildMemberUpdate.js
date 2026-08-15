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

            // SÜREKLİ ROL YEDEKLEME SİSTEMİ (Veritabanı Yedeklemesi)
            const oldRoles = Array.from(oldMember.roles.cache.keys());
            const newRoles = Array.from(newMember.roles.cache.keys());
            
            const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
            const removedRoles = oldRoles.filter(r => !newRoles.includes(r));
            
            if (addedRoles.length > 0 || removedRoles.length > 0) {
                // Sadece veritabanına kaydet (Anlık snapshot). Webhook logEvents.js üzerinden gönderiliyor.
                const rolesJson = JSON.stringify(newRoles);
                await conn.query('INSERT INTO member_roles_snapshot (user_id, guild_id, roles_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE roles_json = ?', [userId, guildId, rolesJson, rolesJson]).catch(()=>{});

                // Canlı Yetkili Panosunu Otomatik Güncelle
                const { updatePublishedStaffBoard } = require('../utils/staffPanelSystem');
                updatePublishedStaffBoard(newMember.guild).catch(() => {});
            }

            // 1. Manuel Timeout Kaldırma Tespiti
            const oldTimeout = oldMember.isCommunicationDisabled();
            const newTimeout = newMember.isCommunicationDisabled();
            if (oldTimeout && !newTimeout) {
                // Timeout kalkmış. Veritabanında aktif Mute var mı bakalım.
                const rows = await conn.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND action_type = "text_mute"', [guildId, userId]);
                if (rows.length > 0) {
                    await conn.query('UPDATE mutes SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND action_type = "text_mute"', [guildId, userId]);
                    if (config.log_channel_id) {
                        const payload = createV2Message({
                            title: 'Ceza Kaldırma (Timeout Bitişi / Manuel)',
                            description: `**Kullanıcı:** ${newMember.user.tag} (<@${userId}>)\nKullanıcının Discord üzerindeki zaman aşımı cezası (timeout) kalktı. Veritabanındaki metin susturma kaydı eşzamanlı olarak silindi.`,
                            color: COLORS.LOG
                        });
                        await sendLog(newMember.guild, payload, 'system').catch(()=>{});
                    }
                }
            }

            // 1.5. Manuel Ban Rolü Verilmesi Tespiti
            if (config.banned_role_id) {
                const bannedRoleId = config.banned_role_id;
                if (!oldMember.roles.cache.has(bannedRoleId) && newMember.roles.cache.has(bannedRoleId)) {
                    
                    const rolesToKeep = newMember.roles.cache
                        .filter(r => !r.editable || r.id === guildId)
                        .map(r => r.id);
                        
                    const rolesToSave = newMember.roles.cache
                        .filter(r => r.editable && r.id !== guildId && r.id !== bannedRoleId)
                        .map(r => r.id);

                    if (!rolesToKeep.includes(bannedRoleId)) {
                        rolesToKeep.push(bannedRoleId);
                    }
                    
                    // Rolleri üstünden al (sadece ban rolü kalsın)
                    await newMember.roles.set(rolesToKeep, 'Manuel Ban Rolü Verilmesi - Sistem otomatik rolleri aldı');

                    // Alınan rolleri veritabanına kaydet
                    if (rolesToSave.length > 0) {
                        const values = rolesToSave.map(rId => [userId, guildId, rId]);
                        await conn.batch('INSERT IGNORE INTO user_roles (user_id, guild_id, role_id) VALUES (?, ?, ?)', values);
                    }
                    
                    if (config.log_channel_id) {
                        const payload = createV2Message({
                            title: 'Ceza (Manuel Yasaklı Rolü Verildi)',
                            description: `**Kullanıcı:** ${newMember.user.tag} (<@${userId}>)\nKullanıcıya el ile **Yasaklı (Ban)** rolü verildi. \nOtomatik sistem kullanıcının diğer tüm yetkili ve normal rollerini söküp veritabanına yedekledi.`,
                            color: COLORS.DANGER
                        });
                        await sendLog(newMember.guild, payload, 'system').catch(()=>{});
                    }
                }
            }

            // 2. Manuel Mute Rolü Kaldırma Tespiti
            const { AuditLogEvent } = require('discord.js');
            
            const checkRolesRemoved = async (roleId, roleTypeDesc, targetAction) => {
                if (!roleId) return;
                const hadRole = oldMember.roles.cache.has(roleId);
                const hasRole = newMember.roles.cache.has(roleId);
                
                if (hadRole && !hasRole) {
                    try {
                        const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                        const logEntry = logs.entries.find(e => e.target.id === userId && e.executor.id === newMember.client.user.id);
                        if (logEntry) return; // Bot yaptıysa görmezden gel (sistem otomatik silmiş/değiştirmiştir)
                    } catch (e) {}

                    const rows = await conn.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND action_type = ?', [guildId, userId, targetAction]);
                    if (rows.length > 0) {
                        await conn.query('UPDATE mutes SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND action_type = ?', [guildId, userId, targetAction]);
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

            await checkRolesRemoved(config.text_mute_role_id, 'Metin Susturma Rolü', 'text_mute');
            await checkRolesRemoved(config.voice_mute_role_id, 'Ses Susturma Rolü', 'voice_mute');

            // 3. Manuel Uyarı/Ban Rolü Kaldırma Tespiti
            const checkWarnRoleRemoved = async (roleId, roleDesc) => {
                if (!roleId) return;
                const hadRole = oldMember.roles.cache.has(roleId);
                const hasRole = newMember.roles.cache.has(roleId);
                if (hadRole && !hasRole) {
                    try {
                        const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                        const logEntry = logs.entries.find(e => e.target.id === userId && e.executor.id === newMember.client.user.id);
                        if (logEntry) return; // Bot yaptıysa görmezden gel
                    } catch (e) {}

                    const warnRows = await conn.query('SELECT id FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
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
            
            // 4. Manuel Rol Verme Tespiti (Uyarı veya Mute rolleri el ile verilirse bot veri tabanına yazsın)
            const checkRoleAdded = async (roleId, actionType, roleDesc) => {
                if (!roleId) return;
                const hadRole = oldMember.roles.cache.has(roleId);
                const hasRole = newMember.roles.cache.has(roleId);
                if (!hadRole && hasRole) {
                    let moderatorId = null;
                    try {
                        const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                        const logEntry = logs.entries.find(e => e.target.id === userId && e.changes.some(c => c.key === '$add' && c.new.some(r => r.id === roleId)));
                        if (logEntry) moderatorId = logEntry.executor.id;
                    } catch (e) {}
                    
                    if (actionType === 'warn') {
                        const warnRows = await conn.query('SELECT id FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [guildId, userId]);
                        if (warnRows.length === 0 || (warnRows.length === 1 && roleId === config.warn2_role_id)) {
                            // Sadece sistemde uyarı eksikse ekle
                            await conn.query('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)', [guildId, userId, moderatorId, `Manuel olarak ${roleDesc} verildi`]);
                        }
                    } else if (actionType === 'mute') {
                        const targetAction = roleId === config.text_mute_role_id ? 'text_mute' : 'voice_mute';
                        const muteRows = await conn.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND action_type = ?', [guildId, userId, targetAction]);
                        if (muteRows.length === 0) {
                            // Mute rolü verilmiş ama timeout yok! Timeout atalım.
                            if (roleId === config.text_mute_role_id) {
                                await newMember.timeout(10 * 60 * 1000, `Manuel ${roleDesc} verildi`).catch(()=>{});
                            }
                            await conn.query('INSERT INTO mutes (guild_id, user_id, moderator_id, reason, action_type) VALUES (?, ?, ?, ?, ?)', [guildId, userId, moderatorId, `Manuel olarak ${roleDesc} verildi`, targetAction]);
                        }
                    } else if (actionType === 'ban') {
                        const muteRows = await conn.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND action_type = "ban"', [guildId, userId]);
                        if (muteRows.length === 0) {
                            await conn.query('INSERT INTO mutes (guild_id, user_id, moderator_id, reason, action_type) VALUES (?, ?, ?, ?, ?)', [guildId, userId, moderatorId, 'Manuel olarak Banned rolü verildi', 'ban']);
                        }
                    }
                }
            };
            
            await checkRoleAdded(config.warn1_role_id, 'warn', '1. Uyarı Rolü');
            await checkRoleAdded(config.warn2_role_id, 'warn', '2. Uyarı Rolü');
            await checkRoleAdded(config.text_mute_role_id, 'mute', 'Metin Susturma Rolü');
            await checkRoleAdded(config.voice_mute_role_id, 'mute', 'Ses Susturma Rolü');
            await checkRoleAdded(config.banned_role_id, 'ban', 'Yasaklı (Banned) Rolü');
            
            // 4. İsim (Nickname) Değişikliği Tespiti
            if (oldMember.nickname !== newMember.nickname) {
                if (config.log_channel_id) {
                    const oldNick = oldMember.nickname || oldMember.user.username;
                    const newNick = newMember.nickname || newMember.user.username;
                    const payload = createV2Message({
                        title: 'İsim Değişikliği (Nickname)',
                        description: `**Kullanıcı:** ${newMember.user.tag} (<@${userId}>)\n\n**Eski Adı:** \`${oldNick}\`\n**Yeni Adı:** \`${newNick}\``,
                        color: COLORS.INFO
                    });
                    await sendLog(newMember.guild, payload, 'system').catch(()=>{});
                }
            }

        } catch (err) {
            console.error("guildMemberUpdate hatası:", err);
        } finally {
            if (conn) conn.release();
        }
    }
};
