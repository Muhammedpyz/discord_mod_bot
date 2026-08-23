'use strict';

const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, COLORS, MONO_EMOJIS } = require('./uiBuilder');
const { sendLog } = require('./logger');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Sunucunun tam bir yapılandırma yedeğini JSON formatında kaydeder.
 */
async function createBackup(guild) {
    if (!guild) throw new Error("Guild not provided for backup.");
    
    const backupData = {
        guildId: guild.id,
        guildName: guild.name,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        categories: [],
        channels: {
            text: [],
            voice: []
        },
        roles: [],
        members: []
    };

    // 1. Kategorileri Çek
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    for (const [id, category] of categories) {
        backupData.categories.push({
            id: category.id,
            name: category.name,
            position: category.position,
            permissions: category.permissionOverwrites.cache.map(p => ({
                id: p.id,
                type: p.type, // 0 for role, 1 for member
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
            }))
        });
    }

    // 2. Kanalları Çek (Yazı & Ses)
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement);
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice);

    for (const [id, channel] of textChannels) {
        backupData.channels.text.push({
            id: channel.id,
            name: channel.name,
            parentId: channel.parentId,
            position: channel.position,
            topic: channel.topic || null,
            nsfw: Boolean(channel.nsfw),
            rateLimitPerUser: channel.rateLimitPerUser || 0,
            permissions: channel.permissionOverwrites.cache.map(p => ({
                id: p.id,
                type: p.type,
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
            }))
        });
    }

    for (const [id, channel] of voiceChannels) {
        backupData.channels.voice.push({
            id: channel.id,
            name: channel.name,
            parentId: channel.parentId,
            position: channel.position,
            bitrate: channel.bitrate || 64000,
            userLimit: channel.userLimit || 0,
            permissions: channel.permissionOverwrites.cache.map(p => ({
                id: p.id,
                type: p.type,
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
            }))
        });
    }

    // 3. Rolleri Çek (Hiyerarşik Sıralı)
    const roles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed).sort((a, b) => b.position - a.position);
    for (const [id, role] of roles) {
        backupData.roles.push({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            hoist: role.hoist,
            position: role.position,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable
        });
    }

    // 4. Üye Rol Eşleştirmelerini Çek
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    for (const [id, member] of members) {
        if (member.user.bot) continue;
        const memberRoles = member.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => r.id);
        if (memberRoles.length > 0) {
            backupData.members.push({
                id: member.user.id,
                username: member.user.username,
                roles: memberRoles
            });
        }
    }

    // JSON Dosyasına Kaydet
    const fileName = `backup-${guild.id}-${backupData.timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    // Sistem Logu Gönder
    const logPayload = createContainerMessage(
        'Sunucu Yedeği Alındı',
        `**Yedek Alan:** Sunucu Yöneticisi\n**Dosya:** \`${fileName}\`\n**Kategoriler:** ${backupData.categories.length} Adet\n**Kanallar:** ${backupData.channels.text.length + backupData.channels.voice.length} Adet\n**Roller:** ${backupData.roles.length} Adet\n**Üye Kayıtları:** ${backupData.members.length} Kişi`,
        COLORS.SUCCESS || '#57F287'
    );
    await sendLog(guild, logPayload, 'system').catch(() => {});

    return { filePath, fileName, backupData, backupId: String(backupData.timestamp) };
}

/**
 * Sunucuya ait mevcut yedekleri listeler.
 */
function listBackups(guildId) {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith(`backup-${guildId}-`) && f.endsWith('.json'));
    const backups = [];

    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
            const data = JSON.parse(raw);
            backups.push({
                fileName: file,
                backupId: String(data.timestamp || file.replace(`backup-${guildId}-`, '').replace('.json', '')),
                timestamp: data.timestamp || 0,
                date: data.date || new Date(data.timestamp).toISOString(),
                categoriesCount: data.categories?.length || 0,
                channelsCount: (data.channels?.text?.length || 0) + (data.channels?.voice?.length || 0),
                rolesCount: data.roles?.length || 0,
                membersCount: data.members?.length || 0
            });
        } catch (e) {}
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Belirtilen yedeği okur.
 */
function getBackup(guildId, backupId) {
    const fileName = `backup-${guildId}-${backupId}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    if (!fs.existsSync(filePath)) return null;

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

/**
 * Yedekten sunucu yapısını (Roller, Kategoriler, Kanallar ve İzinler) geri yükler.
 */
async function restoreBackup(guild, backupId) {
    const backupData = getBackup(guild.id, backupId);
    if (!backupData) throw new Error("Belirtilen yedek dosyası bulunamadı.");

    const roleMap = new Map(); // oldRoleId -> newRole
    const categoryMap = new Map(); // oldCatId -> newCategory

    const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    const botTopPos = me?.roles?.highest?.position || 0;

    let rolesRestored = 0;
    let categoriesRestored = 0;
    let channelsRestored = 0;

    // 1. Rolleri Geri Yükle / Eşle
    if (Array.isArray(backupData.roles)) {
        for (const roleInfo of backupData.roles) {
            let existingRole = guild.roles.cache.find(r => r.name === roleInfo.name && !r.managed);
            if (!existingRole) {
                try {
                    existingRole = await guild.roles.create({
                        name: roleInfo.name,
                        color: roleInfo.color || undefined,
                        hoist: Boolean(roleInfo.hoist),
                        permissions: BigInt(roleInfo.permissions || '0'),
                        mentionable: Boolean(roleInfo.mentionable),
                        reason: `[Backup Restore] Yedekten geri yüklendi (Yedek ID: ${backupId})`
                    });
                    rolesRestored++;
                } catch (rErr) {
                    console.error(`[Backup Restore] Rol oluşturma hatası (${roleInfo.name}):`, rErr.message);
                }
            }
            if (existingRole) {
                roleMap.set(roleInfo.id, existingRole);
            }
        }
    }

    // 2. Kategorileri Geri Yükle
    if (Array.isArray(backupData.categories)) {
        for (const catInfo of backupData.categories) {
            let existingCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === catInfo.name);
            if (!existingCat) {
                try {
                    existingCat = await guild.channels.create({
                        name: catInfo.name,
                        type: ChannelType.GuildCategory,
                        position: catInfo.position || 0,
                        reason: `[Backup Restore] Yedekten geri yüklendi`
                    });
                    categoriesRestored++;
                } catch (cErr) {
                    console.error(`[Backup Restore] Kategori oluşturma hatası (${catInfo.name}):`, cErr.message);
                }
            }
            if (existingCat) {
                categoryMap.set(catInfo.id, existingCat);
            }
        }
    }

    // 3. Yazı Kanallarını Geri Yükle
    if (backupData.channels && Array.isArray(backupData.channels.text)) {
        for (const chanInfo of backupData.channels.text) {
            let existingChan = guild.channels.cache.find(c => c.name === chanInfo.name && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement));
            const parentCat = chanInfo.parentId ? categoryMap.get(chanInfo.parentId) : null;

            if (!existingChan) {
                try {
                    // İzinleri yeni rol ID'lerine eşle
                    const overwrites = [];
                    if (Array.isArray(chanInfo.permissions)) {
                        for (const p of chanInfo.permissions) {
                            if (p.type === 0) { // Role
                                const targetRole = p.id === guild.id ? guild.roles.everyone : roleMap.get(p.id);
                                if (targetRole) {
                                    overwrites.push({
                                        id: targetRole.id,
                                        allow: BigInt(p.allow || '0'),
                                        deny: BigInt(p.deny || '0')
                                    });
                                }
                            }
                        }
                    }

                    await guild.channels.create({
                        name: chanInfo.name,
                        type: ChannelType.GuildText,
                        parent: parentCat ? parentCat.id : undefined,
                        topic: chanInfo.topic || undefined,
                        nsfw: Boolean(chanInfo.nsfw),
                        rateLimitPerUser: chanInfo.rateLimitPerUser || 0,
                        permissionOverwrites: overwrites.length > 0 ? overwrites : undefined,
                        reason: `[Backup Restore] Yedekten geri yüklendi`
                    });
                    channelsRestored++;
                } catch (tErr) {
                    console.error(`[Backup Restore] Yazı kanalı oluşturma hatası (${chanInfo.name}):`, tErr.message);
                }
            }
        }
    }

    // 4. Ses Kanallarını Geri Yükle
    if (backupData.channels && Array.isArray(backupData.channels.voice)) {
        for (const chanInfo of backupData.channels.voice) {
            let existingChan = guild.channels.cache.find(c => c.name === chanInfo.name && c.type === ChannelType.GuildVoice);
            const parentCat = chanInfo.parentId ? categoryMap.get(chanInfo.parentId) : null;

            if (!existingChan) {
                try {
                    const overwrites = [];
                    if (Array.isArray(chanInfo.permissions)) {
                        for (const p of chanInfo.permissions) {
                            if (p.type === 0) {
                                const targetRole = p.id === guild.id ? guild.roles.everyone : roleMap.get(p.id);
                                if (targetRole) {
                                    overwrites.push({
                                        id: targetRole.id,
                                        allow: BigInt(p.allow || '0'),
                                        deny: BigInt(p.deny || '0')
                                    });
                                }
                            }
                        }
                    }

                    await guild.channels.create({
                        name: chanInfo.name,
                        type: ChannelType.GuildVoice,
                        parent: parentCat ? parentCat.id : undefined,
                        bitrate: Math.min(chanInfo.bitrate || 64000, 96000),
                        userLimit: chanInfo.userLimit || 0,
                        permissionOverwrites: overwrites.length > 0 ? overwrites : undefined,
                        reason: `[Backup Restore] Yedekten geri yüklendi`
                    });
                    channelsRestored++;
                } catch (vErr) {
                    console.error(`[Backup Restore] Ses kanalı oluşturma hatası (${chanInfo.name}):`, vErr.message);
                }
            }
        }
    }

    // Sistem Denetim Logu Gönder
    const logPayload = createContainerMessage(
        'Sunucu Yedeği Geri Yüklendi',
        `**Yedek ID:** \`${backupId}\`\n**Oluşturulan Yeni Roller:** ${rolesRestored} Adet\n**Oluşturulan Yeni Kategoriler:** ${categoriesRestored} Adet\n**Oluşturulan Yeni Kanallar:** ${channelsRestored} Adet`,
        COLORS.WARNING || '#FEE75C'
    );
    await sendLog(guild, logPayload, 'system').catch(() => {});

    return { rolesRestored, categoriesRestored, channelsRestored };
}

module.exports = {
    createBackup,
    listBackups,
    getBackup,
    restoreBackup
};
