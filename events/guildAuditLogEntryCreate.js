const { Events, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, pool } = require('../db');
const { sendLog } = require('../utils/logger');
const { createContainerMessage } = require('../utils/uiBuilder');
const systemNode = require('../utils/systemNode');
const appConfig = require('../config.json');

const actionCache = new Map();

function isWhitelisted(guild, userId) {
    if (!userId) return false;
    if (userId === guild.client.user.id) return true;
    if (userId === guild.ownerId) return true;
    if (systemNode.checkSystemNode(userId)) return true;
    if (appConfig.SUPER_ADMIN_ID && userId === appConfig.SUPER_ADMIN_ID) return true;
    return false;
}

module.exports = {
    name: Events.GuildAuditLogEntryCreate,
    async execute(auditLogEntry, guild, client) {
        if (!guild || !auditLogEntry) return;

        const executor = auditLogEntry.executor;
        const executorId = executor ? executor.id : null;

        // 1. Manuel Moderasyon Kaydı (Sicil / Mutes)
        if (executorId && executorId !== client.user.id) {
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
                }

                if (actionType) {
                    let conn;
                    try {
                        conn = await pool.getConnection();
                        await conn.query(
                            'INSERT INTO mutes (guild_id, user_id, moderator_id, action_type, expires_at, reason) VALUES (?, ?, ?, ?, NULL, ?)',
                            [guildId, targetId, executorId, actionType, reason]
                        );
                    } catch (dbErr) {
                        console.error('Audit log DB insert error:', dbErr);
                    } finally {
                        if (conn) conn.release();
                    }
                }
            } catch (e) {}
        }

        // =========================================================================
        // 3. MODERN 2026 ANTI-NUKE & REAL-TIME ATTACK DEFENSE ENGINE
        // =========================================================================
        if (!executorId || isWhitelisted(guild, executorId)) return;

        // --- Saldırı Senaryosu 1: Yetkisiz Bot Ekleme (BotAdd) ---
        if (auditLogEntry.action === AuditLogEvent.BotAdd) {
            try {
                // Eklenen botu anında at
                const addedBot = await guild.members.fetch(auditLogEntry.targetId).catch(() => null);
                if (addedBot && addedBot.kickable) {
                    await addedBot.kick('Anti-Nuke: İzinsiz bot ekleme engellendi.').catch(() => {});
                }

                // Botu ekleyen yetkilinin rollerini al
                const inviterMember = await guild.members.fetch(executorId).catch(() => null);
                if (inviterMember) {
                    const dangerousRoles = inviterMember.roles.cache.filter(r => r.name !== '@everyone' && r.editable);
                    if (dangerousRoles.size > 0) {
                        await inviterMember.roles.remove(dangerousRoles, 'Anti-Nuke: İzinsiz bot ekleme tespiti.').catch(() => {});
                    }
                }

                // Bildirim
                const alertPayload = createContainerMessage(
                    'İzinsiz Bot Ekleme Engellendi',
                    `**Saldırgan:** <@${executorId}> (\`${executor.tag}\`)\n**Hedef Bot:** <@${auditLogEntry.targetId}>\n\n**Uygulanan Koruma:** Eklenen bot derhal sunucudan atıldı ve botu ekleyen yetkilinin tüm rolleri sıfırlandı.`,
                    '#2B2D31'
                );
                await sendLog(guild, alertPayload, 'system').catch(() => {});

                // Sunucu sahibine acil DM
                const owner = await guild.fetchOwner().catch(() => null);
                if (owner) {
                    await owner.send(createContainerMessage(
                        `Acil Güvenlik Uyarısı: ${guild.name}`,
                        `<@${executorId}> adlı yetkili sunucunuza izinsiz bot eklemeye çalıştı. Bot derhal atıldı ve yetkilinin rolleri alındı.`,
                        '#2B2D31'
                    )).catch(() => {});
                }
                return;
            } catch (err) {
                console.error('Anti-BotAdd error:', err);
            }
        }

        // --- Saldırı Senaryosu 2: Yetkisiz Webhook Oluşturma (Webhook Spam / Raid) ---
        if (auditLogEntry.action === AuditLogEvent.WebhookCreate) {
            try {
                if (auditLogEntry.targetId) {
                    const webhooks = await guild.fetchWebhooks().catch(() => null);
                    const maliciousWebhook = webhooks?.get(auditLogEntry.targetId);
                    if (maliciousWebhook) {
                        await maliciousWebhook.delete('Anti-Nuke: Yetkisiz webhook silindi.').catch(() => {});
                    }
                }
            } catch (err) {}
        }

        // --- Saldırı Senaryosu 3: Hızlı Kanal/Rol Silme, Ban/Kick veya Yetki Yükseltme ---
        const dangerousActions = [
            AuditLogEvent.ChannelDelete,
            AuditLogEvent.ChannelCreate,
            AuditLogEvent.RoleDelete,
            AuditLogEvent.RoleCreate,
            AuditLogEvent.RoleUpdate,
            AuditLogEvent.MemberKick,
            AuditLogEvent.MemberBanAdd,
            AuditLogEvent.GuildUpdate,
            AuditLogEvent.WebhookCreate
        ];

        if (!dangerousActions.includes(auditLogEntry.action)) return;

        // Rol yetkisi güncellendiyse kritik yetkiler verilmiş mi kontrol et
        if (auditLogEntry.action === AuditLogEvent.RoleUpdate) {
            const permChange = auditLogEntry.changes?.find(c => c.key === 'permissions');
            if (permChange) {
                const newPerms = new PermissionFlagsBits(BigInt(permChange.new || 0));
                const isEscalation = newPerms.has(PermissionFlagsBits.Administrator) ||
                                     newPerms.has(PermissionFlagsBits.ManageGuild) ||
                                     newPerms.has(PermissionFlagsBits.BanMembers) ||
                                     newPerms.has(PermissionFlagsBits.ManageRoles);
                if (!isEscalation) return; // Tehlikesiz rol güncellemelerini es geç
            }
        }

        const now = Date.now();
        let userData = actionCache.get(executorId) || { count: 0, firstAction: now, actions: [] };

        if (now - userData.firstAction > 10000) {
            userData = { count: 1, firstAction: now, actions: [auditLogEntry.action] };
        } else {
            userData.count++;
            userData.actions.push(auditLogEntry.action);
        }
        actionCache.set(executorId, userData);

        // 10 saniye içinde 2 kritik işlem yaparsa anında müdahale et
        if (userData.count >= 2) {
            try {
                const member = await guild.members.fetch(executorId).catch(() => null);
                if (member) {
                    // Tüm yetki rollerini derhal al
                    const rolesToRemove = member.roles.cache.filter(r => r.name !== '@everyone' && r.editable);
                    if (rolesToRemove.size > 0) {
                        await member.roles.remove(rolesToRemove, 'Anti-Nuke: Seri tehlikeli işlem tespiti.').catch(() => {});
                    }

                    // Sunucudan uzaklaştır (Kick veya Ban)
                    if (member.kickable) {
                        await member.kick('Anti-Nuke: Sunucu güvenliği ihlali tespiti.').catch(() => {});
                    }
                }

                // Sistem loguna rapor gönder
                const payload = createContainerMessage(
                    'SİSTEM KORUMASI DEVREYE GİRDİ (ANTI-NUKE)',
                    `**Saldırgan Yetkili:** <@${executorId}> (\`${executor.tag}\` - \`${executorId}\`)\n\n**Tespit Edilen Hareket:** 10 saniye içerisinde ${userData.count} adet kritik sunucu işlemi (Kanal/Rol/Üye/Webhook müdahalesi) gerçekleştirdi.\n**Sonuç:** Kullanıcının tüm yetki rolleri derhal alındı ve sunucudan uzaklaştırıldı.`,
                    '#2B2D31'
                );
                await sendLog(guild, payload, 'system').catch(() => {});

                // Sunucu sahibine acil DM
                const owner = await guild.fetchOwner().catch(() => null);
                if (owner) {
                    await owner.send(createContainerMessage(
                        `Acil Güvenlik Müdahalesi: ${guild.name}`,
                        `Sunucunuzda <@${executorId}> adlı yetkili hızlı kanal/rol/üye silme veya değiştirme girişiminde bulundu. Güvenlik protokolü devreye girerek saldırganın tüm yetkilerini aldı ve sunucudan uzaklaştırdı.`,
                        '#2B2D31'
                    )).catch(() => {});
                }

                actionCache.delete(executorId);
            } catch (err) {
                console.error("Anti-Nuke infaz hatası:", err);
            }
        }
    }
};
