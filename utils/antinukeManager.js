'use strict';

const { PermissionFlagsBits, AuditLogEvent, MessageFlags } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const { fastBan, fastDeleteWebhook } = require('./fastBanEngine');
const config = require('../config.json');

// Korumalar için hareket takip havuzu (Sliding Window Rate Limit)
const actionTracker = new Map(); // key: `${guildId}:${executorId}:${actionType}` -> array of timestamps

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of actionTracker.entries()) {
        const valid = timestamps.filter(t => now - t < 60000);
        if (valid.length === 0) {
            actionTracker.delete(key);
        } else {
            actionTracker.set(key, valid);
        }
    }
}, 5 * 60 * 1000);

function checkRateLimit(guildId, executorId, actionType, limit, windowSeconds = 10) {
    const key = `${guildId}:${executorId}:${actionType}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let timestamps = actionTracker.get(key) || [];
    // Eski zaman damgalarını temizle
    timestamps = timestamps.filter(t => now - t < windowMs);
    timestamps.push(now);
    actionTracker.set(key, timestamps);

    return timestamps.length > limit;
}

async function isWhitelisted(guild, executorId) {
    if (!guild || !executorId) return true;
    // 1. Sunucu Sahibi
    if (guild.ownerId === executorId) return true;
    // 2. Botun Kendisi
    if (guild.client.user.id === executorId) return true;
    // 3. Super Admin
    if (config.SUPER_ADMIN_ID && config.SUPER_ADMIN_ID === executorId) return true;

    // 4. Veritabanı Anti-Nuke Whitelist Tablosu
    const whitelist = await db.getAntiNukeWhitelist(guild.id).catch(() => []);
    if (whitelist.some(w => w.target_id === executorId && w.target_type === 'user')) return true;

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (member) {
        const roleIds = member.roles.cache.map(r => r.id);
        // Anti-Nuke Whitelist rolleri
        if (whitelist.some(w => roleIds.includes(w.target_id) && w.target_type === 'role')) return true;

        // 5. AutoMod Muafiyet Rolleri Senkronizasyonu
        const amConfig = await db.getAutoModConfig(guild.id).catch(() => null);
        if (amConfig && amConfig.exempt_roles) {
            try {
                const exRoles = typeof amConfig.exempt_roles === 'string' ? JSON.parse(amConfig.exempt_roles) : amConfig.exempt_roles;
                if (Array.isArray(exRoles) && exRoles.some(rId => roleIds.includes(rId))) {
                    return true;
                }
            } catch (e) {}
        }
    }

    return false;
}

async function executePunishment(guild, executorId, actionType, details, antinukeConfig) {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;

    // Sunucu sahibine veya bota işlem yapılamaz
    if (member.id === guild.ownerId || member.id === guild.client.user.id) return;

    const punishment = antinukeConfig?.punishment || 'strip_roles';
    let takenAction = 'Yetkileri Alındı & Otorol Verildi';

    try {
        if (punishment === 'ban') {
            // Ultra Hızlı HTTP/2 Direct Ban
            const ok = await fastBan(guild.id, executorId, `[Anti-Nuke Kalkanı] ${details}`);
            if (!ok) {
                await member.ban({ reason: `[Anti-Nuke Kalkanı] ${details}` }).catch(() => {});
            }
            takenAction = 'Sunucudan Yasaklandı (Ban)';
        } else if (punishment === 'kick') {
            await member.kick(`[Anti-Nuke Kalkanı] ${details}`).catch(() => {});
            takenAction = 'Sunucudan Atıldı (Kick)';
        } else {
            // Varsayılan: Kullanıcıyı BANLAMADAN tüm yetki rollerini al ve standart Otorolü ver
            const rolesToRemove = member.roles.cache.filter(role => {
                if (role.id === guild.id) return false;
                return role.editable;
            });

            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove, `[Anti-Nuke Kalkanı] ${details}`).catch(() => {});
            }

            // Otorol Rolünü Tanımla
            let givenRoleName = null;
            try {
                const { getAutoroleConfig } = require('./autoroleSystem');
                const aConfig = await getAutoroleConfig(guild.id).catch(() => null);
                const gConfig = await db.getGuildConfig(guild.id).catch(() => null);
                const autoroleId = aConfig?.user_role_id || gConfig?.autorole_id;

                if (autoroleId && guild.roles.cache.has(autoroleId)) {
                    const aRole = guild.roles.cache.get(autoroleId);
                    if (aRole && aRole.editable) {
                        await member.roles.add(aRole, 'Anti-Nuke: Yetkiler alındı, standart üye otorolü tanımlandı.').catch(() => {});
                        givenRoleName = aRole.name;
                    }
                }
            } catch (e) {}

            takenAction = givenRoleName 
                ? `Roller Sıfırlandı + Standart Otorol Verildi (@${givenRoleName})` 
                : `Yönetici Rolleri Sıfırlandı (${rolesToRemove.size} Rol Alındı)`;
        }
    } catch (e) {
        console.error('[Anti-Nuke] Ceza uygulama hatası:', e);
    }

    // 1. Veritabanına Log Kaydı
    await db.addAntiNukeLog(guild.id, executorId, actionType, details, takenAction).catch(() => {});

    // 2. Log Kanalına ve Sistem Loguna Bildirim Gönderme
    const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Anti-Nuke Kalkanı Tetiklendi!`;
    const desc = `Sunucuda şüpheli/zararlı yetkili işlemi tespit edildi ve güvenlik protokolü devreye girdi.`;
    const fields = [
        { name: 'Saldırgan Yetkili', value: `<@${executorId}> (\`${member?.user?.tag || executorId}\` - \`${executorId}\`)`, inline: true },
        { name: 'İşlem Türü', value: `\`${actionType}\``, inline: true },
        { name: 'Uygulanan Yaptırım', value: `\`${takenAction}\``, inline: true },
        { name: 'Olay Detayı', value: details, inline: false },
        { name: 'Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
    ];
    const logMsg = createContainerMessage(title, desc, '#ED4245', [], fields, false);

    if (antinukeConfig?.log_channel_id) {
        const logChannel = guild.channels.cache.get(antinukeConfig.log_channel_id);
        if (logChannel) {
            await logChannel.send(logMsg).catch(() => {});
        }
    } else {
        const { sendLog } = require('./logger');
        await sendLog(guild, logMsg, 'system').catch(() => {});
    }

    // 3. Sunucu Sahibine Acil DM Bildirimi
    try {
        const owner = await guild.fetchOwner().catch(() => null);
        if (owner && owner.id !== executorId) {
            const ownerMsg = createContainerMessage(
                `<:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Acil Güvenlik Müdahalesi: ${guild.name}`,
                `Sunucunuzda **${actionType}** işlemi tespit edildi.\n\n` +
                `**Saldırgan:** <@${executorId}> (\`${member?.user?.tag || executorId}\`)\n` +
                `**Uygulanan Ceza:** \`${takenAction}\`\n` +
                `**Detay:** ${details}`,
                '#ED4245'
            );
            await owner.send(ownerMsg).catch(() => {});
        }
    } catch (e) {}
}

// Olay Denetleyicisi (Audit Log tabanlı genel denetleyici)
async function handleAntiNukeAuditEntry(entry, guild) {
    if (!guild || !entry || !entry.executorId) return;

    const antinukeConfig = await db.getAntiNukeConfig(guild.id).catch(() => null);
    if (!antinukeConfig || !antinukeConfig.is_enabled) return;

    const executorId = entry.executorId;
    if (await isWhitelisted(guild, executorId)) return;

    switch (entry.action) {
        // 1. KANAL SİLME
        case AuditLogEvent.ChannelDelete: {
            const limit = antinukeConfig.channel_delete_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'channel_delete', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Kanal Silme', `10 saniye içinde ${limit}'ten fazla kanal sildi.`, antinukeConfig);
            }
            break;
        }

        // 2. KANAL OLUŞTURMA
        case AuditLogEvent.ChannelCreate: {
            const limit = antinukeConfig.channel_create_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'channel_create', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Kanal Oluşturma', `10 saniye içinde ${limit}'ten fazla kanal oluşturdu.`, antinukeConfig);
            }
            break;
        }

        // 3. ROL SİLME
        case AuditLogEvent.RoleDelete: {
            const limit = antinukeConfig.role_delete_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'role_delete', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Rol Silme', `10 saniye içinde ${limit}'ten fazla rol sildi.`, antinukeConfig);
            }
            break;
        }

        // 4. ROL OLUŞTURMA
        case AuditLogEvent.RoleCreate: {
            const limit = antinukeConfig.role_create_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'role_create', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Rol Oluşturma', `10 saniye içinde ${limit}'ten fazla rol oluşturdu.`, antinukeConfig);
            }
            break;
        }

        // 5. TEHLİKELİ ROL YETKİSİ YÜKSELTME / @EVERYONE ADMIN KORUMASI
        case AuditLogEvent.RoleUpdate: {
            if (antinukeConfig.anti_everyone_admin !== false) {
                const permChange = entry.changes?.find(c => c.key === 'permissions');
                if (permChange) {
                    const newPerms = new PermissionFlagsBits(BigInt(permChange.new || 0));
                    const isDangerous = newPerms.has(PermissionFlagsBits.Administrator) ||
                                         newPerms.has(PermissionFlagsBits.ManageGuild) ||
                                         newPerms.has(PermissionFlagsBits.BanMembers) ||
                                         newPerms.has(PermissionFlagsBits.ManageRoles);
                    
                    const isEveryoneRole = entry.targetId === guild.id;

                    if (isDangerous) {
                        // Yetkiyi anında geri al
                        try {
                            const targetRole = guild.roles.cache.get(entry.targetId) || await guild.roles.fetch(entry.targetId).catch(() => null);
                            if (targetRole && targetRole.editable) {
                                const oldBits = permChange.old ? BigInt(permChange.old) : (targetRole.permissions.bitfield & ~PermissionFlagsBits.Administrator & ~PermissionFlagsBits.ManageGuild & ~PermissionFlagsBits.ManageRoles);
                                await targetRole.setPermissions(oldBits, 'Anti-Nuke: Yetkisiz tehlikeli izin değişikliği derhal geri alındı.').catch(() => {});
                            }
                        } catch (revertErr) {
                            console.error('[Anti-Nuke] Rol izin geri alma hatası:', revertErr.message);
                        }

                        const targetRoleText = isEveryoneRole ? '@everyone' : `<@&${entry.targetId}>`;
                        await executePunishment(
                            guild,
                            executorId,
                            isEveryoneRole ? 'Anti-Everyone Yetki Koruması' : 'Tehlikeli Yetki Yükseltme',
                            `İzinsiz olarak ${targetRoleText} rolüne kritik yönetim yetkisi verildi. Yetkiler anında geri alındı.`,
                            antinukeConfig
                        );
                    }
                }
            }
            break;
        }

        // 6. TOPLU BAN
        case AuditLogEvent.MemberBanAdd: {
            const limit = antinukeConfig.ban_limit || 4;
            if (checkRateLimit(guild.id, executorId, 'mass_ban', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Üye Yasaklama (Mass Ban)', `10 saniye içinde ${limit}'ten fazla üyeyi yasakladı.`, antinukeConfig);
            }
            break;
        }

        // 7. TOPLU KICK
        case AuditLogEvent.MemberKick: {
            const limit = antinukeConfig.kick_limit || 4;
            if (checkRateLimit(guild.id, executorId, 'mass_kick', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Üye Atma (Mass Kick)', `10 saniye içinde ${limit}'ten fazla üyeyi attı.`, antinukeConfig);
            }
            break;
        }

        // 8. İZİNSİZ BAN KALDIRMA -> RE-BAN
        case AuditLogEvent.MemberBanRemove: {
            if (antinukeConfig.anti_unban !== false) {
                const targetId = entry.targetId;
                if (targetId) {
                    // Ultra hızlı Re-Ban
                    await fastBan(guild.id, targetId, '[Anti-Nuke] İzinsiz ban kaldırma tespit edildi -> Otomatik Re-Ban uygulandı.');
                }
                await executePunishment(guild, executorId, 'İzinsiz Ban Kaldırma (Anti-Unban)', `Kullanıcının (<@${targetId}>) banını izinsiz kaldırdı. Otomatik Re-Ban uygulandı.`, antinukeConfig);
            }
            break;
        }

        // 9. İZİNSİZ BOT EKLEME
        case AuditLogEvent.BotAdd: {
            if (antinukeConfig.anti_bot_add !== false) {
                const botTarget = entry.target;
                if (botTarget && botTarget.id) {
                    const botMember = await guild.members.fetch(botTarget.id).catch(() => null);
                    if (botMember) {
                        await botMember.kick('İzinsiz bot ekleme (Anti-Nuke: Anti-Bot)').catch(() => {});
                    }
                }
                await executePunishment(guild, executorId, 'İzinsiz Bot Ekleme (Anti-Bot)', `İzinsiz olarak sunucuya bot (${botTarget ? botTarget.tag : 'Bilinmeyen Bot'}) ekledi.`, antinukeConfig);
            }
            break;
        }

        // 10. İZİNSİZ WEBHOOK OLUŞTURMA / DÜZENLEME
        case AuditLogEvent.WebhookCreate:
        case AuditLogEvent.WebhookUpdate:
        case AuditLogEvent.WebhookDelete: {
            if (antinukeConfig.anti_webhook !== false) {
                if (entry.targetId && entry.action !== AuditLogEvent.WebhookDelete) {
                    await fastDeleteWebhook(entry.targetId, 'Anti-Nuke: İzinsiz webhook derhal silindi.');
                }
                await executePunishment(guild, executorId, 'İzinsiz Webhook İşlemi (Anti-Webhook)', 'Yetkisiz webhook oluşturma/düzenleme tespit edildi.', antinukeConfig);
            }
            break;
        }

        // 11. İZİNSİZ ENTEGRASYON EKLEME
        case AuditLogEvent.IntegrationCreate: {
            if (antinukeConfig.anti_integration !== false) {
                await executePunishment(guild, executorId, 'İzinsiz Entegrasyon (Anti-Integration)', 'Yetkisiz uygulama entegrasyonu oluşturmaya çalıştı.', antinukeConfig);
            }
            break;
        }

        // 12. TOPLU ÜYE TEMİZLEME (PRUNE)
        case AuditLogEvent.MemberPrune: {
            await executePunishment(guild, executorId, 'Toplu Üye Temizleme (Anti-Prune)', 'Discord Prune özelliği ile toplu üye atmaya çalıştı.', antinukeConfig);
            break;
        }

        // 13. SUNUCU ADI / VANITY / ICON DEĞİŞTİRME (SUNUCU GÜNCELLEME KORUMASI)
        case AuditLogEvent.GuildUpdate: {
            if (antinukeConfig.anti_server_update !== false) {
                let revertedDetails = [];
                try {
                    const nameChange = entry.changes?.find(c => c.key === 'name');
                    if (nameChange && nameChange.old) {
                        await guild.setName(nameChange.old, 'Anti-Nuke: İzinsiz sunucu adı değişikliği geri alındı.').catch(() => {});
                        revertedDetails.push(`İsim "${nameChange.new}" -> "${nameChange.old}"`);
                    }

                    const verificationChange = entry.changes?.find(c => c.key === 'verification_level');
                    if (verificationChange && verificationChange.old !== undefined) {
                        await guild.setVerificationLevel(verificationChange.old, 'Anti-Nuke: Doğrulama seviyesi geri alındı.').catch(() => {});
                        revertedDetails.push('Doğrulama seviyesi');
                    }

                    const defaultNotifsChange = entry.changes?.find(c => c.key === 'default_message_notifications');
                    if (defaultNotifsChange && defaultNotifsChange.old !== undefined) {
                        await guild.setDefaultMessageNotifications(defaultNotifsChange.old, 'Anti-Nuke: Bildirim ayarı geri alındı.').catch(() => {});
                        revertedDetails.push('Bildirim ayarı');
                    }
                } catch (revertErr) {
                    console.error('[Anti-Nuke] Sunucu bilgisi geri alma hatası:', revertErr.message);
                }

                const detailMsg = revertedDetails.length > 0
                    ? `İzinsiz sunucu ayarları değiştirildi: ${revertedDetails.join(', ')}. Değişiklikler geri alındı.`
                    : 'Sunucu ayarlarını (İsim, İkon, Güvenlik vb.) izinsiz değiştirdi.';

                await executePunishment(guild, executorId, 'İzinsiz Sunucu Bilgisi Değiştirme (Anti-Server-Update)', detailMsg, antinukeConfig);
            } else {
                const limit = 2;
                if (checkRateLimit(guild.id, executorId, 'guild_update', limit, 15)) {
                    await executePunishment(guild, executorId, 'Seri Sunucu Bilgisi Değiştirme', 'Sunucu ayarlarını (İsim, İkon, Vanity URL vb.) izinsiz değiştirdi.', antinukeConfig);
                }
            }
            break;
        }
    }
}

module.exports = {
    handleAntiNukeAuditEntry,
    isWhitelisted,
    executePunishment
};
