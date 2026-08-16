const { PermissionFlagsBits, AuditLogEvent, MessageFlags } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const config = require('../config.json');

// Korumalar için hareket takip havuzu (Sliding Window Rate Limit)
const actionTracker = new Map(); // key: `${guildId}:${executorId}:${actionType}` -> array of timestamps

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

    // 4. Veritabanı Whitelist Tablosu
    const whitelist = await db.getAntiNukeWhitelist(guild.id).catch(() => []);
    if (whitelist.some(w => w.target_id === executorId && w.target_type === 'user')) return true;

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (member) {
        const roleIds = member.roles.cache.map(r => r.id);
        if (whitelist.some(w => roleIds.includes(w.target_id) && w.target_type === 'role')) return true;
    }

    return false;
}

async function executePunishment(guild, executorId, actionType, details, antinukeConfig) {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;

    // Sunucu sahibine veya bota işlem yapılamaz
    if (member.id === guild.ownerId || member.id === guild.client.user.id) return;

    const punishment = antinukeConfig.punishment || 'strip_roles';
    let takenAction = 'Yetkileri Alındı';

    try {
        if (punishment === 'ban') {
            await member.ban({ reason: `[Anti-Nuke Kalkanı] ${details}` }).catch(() => {});
            takenAction = 'Sunucudan Yasaklandı (Ban)';
        } else if (punishment === 'kick') {
            await member.kick(`[Anti-Nuke Kalkanı] ${details}`).catch(() => {});
            takenAction = 'Sunucudan Atıldı (Kick)';
        } else {
            // Varsayılan: Tehlikeli Yönetici/Moderasyon rollerini al
            const dangerousPermissions = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.ManageGuild,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.ManageWebhooks
            ];

            const rolesToRemove = member.roles.cache.filter(role => {
                if (role.id === guild.id) return false;
                return dangerousPermissions.some(perm => role.permissions.has(perm));
            });

            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove, `[Anti-Nuke Kalkanı] ${details}`).catch(() => {});
                takenAction = `Yönetici Rolleri Alındı (${rolesToRemove.map(r => r.name).join(', ')})`;
            }
        }
    } catch (e) {
        console.error('[Anti-Nuke] Ceza uygulama hatası:', e);
    }

    // Veritabanına Log Kaydı
    await db.addAntiNukeLog(guild.id, executorId, actionType, details, takenAction).catch(() => {});

    // Log Kanalına Bildirim Gönderme
    if (antinukeConfig.log_channel_id) {
        const logChannel = guild.channels.cache.get(antinukeConfig.log_channel_id);
        if (logChannel) {
            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Anti-Nuke Kalkanı Tetiklendi!`;
            const desc = `Sunucuda şüpheli/zararlı seri işlem tespit edildi ve saldırgan anında etkisiz hale getirildi.`;
            const fields = [
                { name: 'Saldırgan Yetkili', value: `<@${executorId}> (\`${executorId}\`)`, inline: true },
                { name: 'İşlem Türü', value: `\`${actionType}\``, inline: true },
                { name: 'Uygulanan Yaptırım', value: `\`${takenAction}\``, inline: true },
                { name: 'Olay Detayı', value: details, inline: false }
            ];
            const logMsg = createContainerMessage(title, desc, '#ED4245', [], fields, false);
            await logChannel.send(logMsg).catch(() => {});
        }
    }
}

// Olay Denetleyicisi (Audit Log tabanlı genel denetleyici)
async function handleAntiNukeAuditEntry(entry, guild) {
    if (!guild || !entry || !entry.executorId) return;

    const antinukeConfig = await db.getAntiNukeConfig(guild.id).catch(() => null);
    if (!antinukeConfig || !antinukeConfig.is_enabled) return;

    const executorId = entry.executorId;
    if (await isWhitelisted(guild, executorId)) return;

    switch (entry.action) {
        case AuditLogEvent.ChannelDelete: {
            const limit = antinukeConfig.channel_delete_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'channel_delete', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Kanal Silme', `10 saniye içinde ${limit}'ten fazla kanal sildi.`, antinukeConfig);
            }
            break;
        }

        case AuditLogEvent.ChannelCreate: {
            const limit = antinukeConfig.channel_create_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'channel_create', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Kanal Oluşturma', `10 saniye içinde ${limit}'ten fazla kanal oluşturdu.`, antinukeConfig);
            }
            break;
        }

        case AuditLogEvent.RoleDelete: {
            const limit = antinukeConfig.role_delete_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'role_delete', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Rol Silme', `10 saniye içinde ${limit}'ten fazla rol sildi.`, antinukeConfig);
            }
            break;
        }

        case AuditLogEvent.RoleCreate: {
            const limit = antinukeConfig.role_create_limit || 3;
            if (checkRateLimit(guild.id, executorId, 'role_create', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Rol Oluşturma', `10 saniye içinde ${limit}'ten fazla rol oluşturdu.`, antinukeConfig);
            }
            break;
        }

        case AuditLogEvent.MemberBanAdd: {
            const limit = antinukeConfig.ban_limit || 4;
            if (checkRateLimit(guild.id, executorId, 'mass_ban', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Üye Yasaklama (Mass Ban)', `10 saniye içinde ${limit}'ten fazla üyeyi yasakladı.`, antinukeConfig);
            }
            break;
        }

        case AuditLogEvent.MemberKick: {
            const limit = antinukeConfig.kick_limit || 4;
            if (checkRateLimit(guild.id, executorId, 'mass_kick', limit, 10)) {
                await executePunishment(guild, executorId, 'Seri Üye Atma (Mass Kick)', `10 saniye içinde ${limit}'ten fazla üyeyi attı.`, antinukeConfig);
            }
            break;
        }

        case AuditLogEvent.BotAdd: {
            // İzinsiz Bot Ekleme Engeli
            const botTarget = entry.target;
            await executePunishment(guild, executorId, 'İzinsiz Bot Ekleme', `İzinsiz olarak sunucuya bot (${botTarget ? botTarget.tag : 'Bilinmeyen Bot'}) ekledi.`, antinukeConfig);
            if (botTarget && botTarget.id) {
                const botMember = await guild.members.fetch(botTarget.id).catch(() => null);
                if (botMember) {
                    await botMember.kick('İzinsiz bot ekleme (Anti-Nuke)').catch(() => {});
                }
            }
            break;
        }

        case AuditLogEvent.WebhookCreate: {
            // İzinsiz Webhook Engeli
            await executePunishment(guild, executorId, 'İzinsiz Webhook Oluşturma', `Yetkisiz webhook oluşturmaya çalıştı.`, antinukeConfig);
            break;
        }
    }
}

module.exports = {
    handleAntiNukeAuditEntry,
    isWhitelisted,
    executePunishment
};
