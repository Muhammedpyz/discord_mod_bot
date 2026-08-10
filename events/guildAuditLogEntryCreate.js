const { Events, AuditLogEvent } = require('discord.js');
const { getGuildConfig, pool } = require('../db');
const { sendLog } = require('../utils/logger');
const { createContainerMessage, COLORS } = require('../utils/uiBuilder');

const actionCache = new Map();

module.exports = {
    name: Events.GuildAuditLogEntryCreate,
    async execute(auditLogEntry, guild, client) {
        // Log manual actions to database
        if (auditLogEntry.executor && auditLogEntry.executor.id !== client.user.id) {
            const executorId = auditLogEntry.executor.id;
            const targetId = auditLogEntry.targetId;
            const reason = auditLogEntry.reason || 'Manuel İşlem (Discord UI)';
            const guildId = guild.id;

            try {
                let actionType = null;
                
                if (auditLogEntry.action === AuditLogEvent.MemberBanAdd) {
                    actionType = 'ban';
                } else if (auditLogEntry.action === AuditLogEvent.MemberKick) {
                    actionType = 'kick';
                } else if (auditLogEntry.action === AuditLogEvent.MemberUpdate) {
                    const timeoutChange = auditLogEntry.changes?.find(c => c.key === 'communication_disabled_until');
                    if (timeoutChange && timeoutChange.new) {
                        actionType = 'text_mute';
                    }
                } else if (auditLogEntry.action === AuditLogEvent.MemberRoleUpdate) {
                    // Rol güncellemelerini artık guildMemberUpdate.js yönetiyor.
                    // Burada çakışma olmaması için loglamıyoruz.
                }

                if (actionType) {
                    const conn = await pool.getConnection();
                    await conn.query(
                        'INSERT INTO mutes (guild_id, user_id, moderator_id, action_type, expires_at, reason) VALUES (?, ?, ?, ?, NULL, ?)',
                        [guildId, targetId, executorId, actionType, reason]
                    );
                    conn.release();
                }
            } catch (dbErr) {
                console.error('Audit log DB insert error:', dbErr);
            }
        }

        // --- Detaylı Sunucu Logları (Kanal & Rol) ---
        if (auditLogEntry.executor && auditLogEntry.executor.id !== client.user.id) {
            let config;
            try {
                config = await getGuildConfig(guild.id);
            } catch(e) {}

            if (config && config.log_channel_id) {
                const { createV2Message } = require('../utils/uiBuilder');
                let logTitle = null;
                let logDesc = null;
                const executorMention = `<@${auditLogEntry.executor.id}>`;

                if (auditLogEntry.action === AuditLogEvent.ChannelCreate) {
                    logTitle = 'Kanal Oluşturuldu';
                    logDesc = `**Yetkili:** ${executorMention}\n**Kanal:** <#${auditLogEntry.targetId}> (\`${auditLogEntry.target.name}\`)`;
                } else if (auditLogEntry.action === AuditLogEvent.ChannelDelete) {
                    logTitle = 'Kanal Silindi';
                    logDesc = `**Yetkili:** ${executorMention}\n**Kanal:** \`${auditLogEntry.target.name}\``;
                } else if (auditLogEntry.action === AuditLogEvent.RoleCreate) {
                    logTitle = 'Rol Oluşturuldu';
                    logDesc = `**Yetkili:** ${executorMention}\n**Rol:** <@&${auditLogEntry.targetId}> (\`${auditLogEntry.target.name}\`)`;
                } else if (auditLogEntry.action === AuditLogEvent.RoleDelete) {
                    logTitle = 'Rol Silindi';
                    logDesc = `**Yetkili:** ${executorMention}\n**Rol:** \`${auditLogEntry.target.name}\``;
                } else if (auditLogEntry.action === AuditLogEvent.RoleUpdate) {
                    const permChange = auditLogEntry.changes?.find(c => c.key === 'permissions');
                    if (permChange) {
                        logTitle = 'Rol Yetkileri Değiştirildi';
                        logDesc = `**Yetkili:** ${executorMention}\n**Rol:** <@&${auditLogEntry.targetId}>\n*Bu rolün yetkileri güncellendi!*`;
                    }
                }

                if (logTitle && logDesc) {
                    const payload = createV2Message({
                        title: logTitle,
                        description: logDesc,
                        color: COLORS.WARNING
                    });
                    await sendLog(guild, payload, 'system').catch(()=>{});
                }
            }
        }

        if (!auditLogEntry.executor || auditLogEntry.executor.id === client.user.id) return;
        
        if (auditLogEntry.executor.id === guild.ownerId) return;

        const dangerousActions = [
            AuditLogEvent.ChannelDelete,
            AuditLogEvent.RoleDelete,
            AuditLogEvent.MemberKick,
            AuditLogEvent.MemberBanAdd,
            AuditLogEvent.GuildUpdate,
            AuditLogEvent.WebhookCreate
        ];

        if (!dangerousActions.includes(auditLogEntry.action)) return;

        const executorId = auditLogEntry.executor.id;
        const now = Date.now();
        
        let userData = actionCache.get(executorId) || { count: 0, firstAction: now };
        
        if (now - userData.firstAction > 10000) {
            userData = { count: 1, firstAction: now };
        } else {
            userData.count++;
        }
        actionCache.set(executorId, userData);

        if (userData.count >= 3) {
            try {
                const member = await guild.members.fetch(executorId).catch(() => null);
                if (member) {
                    const rolesToRemove = member.roles.cache.filter(r => r.name !== '@everyone' && r.editable);
                    if (rolesToRemove.size > 0) {
                        await member.roles.remove(rolesToRemove, 'Sistem Koruması: Çok sayıda şüpheli işlem tespiti.').catch(()=>{});
                    }
                    
                    if (member.kickable) {
                        await member.kick('Sistem Koruması: Sunucu güvenliğini tehlikeye atma girişimi engellendi.').catch(()=>{});
                    }
                }

                let config;
                try {
                    config = await getGuildConfig(guild.id);
                } catch(e) {
                    console.error("Config fetch error:", e);
                }

                if (config && config.log_channel_id) {
                    const payload = createContainerMessage(
                        'SİSTEM KORUMASI DEVREYE GİRDİ',
                        `**Kullanıcı:** <@${executorId}> (${auditLogEntry.executor.tag})\n\n**Neden:** Kısa süre içinde yetkisiz veya şüpheli sayılabilecek işlemler gerçekleştirdi.\n**Sonuç:** Kullanıcının yetkileri askıya alındı ve sunucudan uzaklaştırıldı.`,
                        COLORS.ERROR
                    );
                    await sendLog(guild, payload, 'system').catch(()=>{});
                }

                actionCache.delete(executorId);
            } catch (err) {
                console.error("Anti-Nuke yetki hatası:", err);
            }
        }
    }
};
