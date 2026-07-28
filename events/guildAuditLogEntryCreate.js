const { Events, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../db');
const { sendLog } = require('../utils/logger');
const { createContainerMessage, COLORS } = require('../utils/uiBuilder');

const actionCache = new Map();

module.exports = {
    name: Events.GuildAuditLogEntryCreate,
    async execute(auditLogEntry, guild, client) {
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
                    await sendLog(guild, payload).catch(()=>{});
                }

                actionCache.delete(executorId);
            } catch (err) {
                console.error("Anti-Nuke yetki hatası:", err);
            }
        }
    }
};
