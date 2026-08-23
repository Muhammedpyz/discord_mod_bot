'use strict';

const { Events, AuditLogEvent, ChannelType, escapeMarkdown, PermissionFlagsBits } = require('discord.js');
const { sendLog, sendVoiceLog, resolveAuditExecutor, PERMISSION_NAMES_TR } = require('../utils/logger');
const { buildModBResponse, createContainerMessage, MONO_EMOJIS } = require('../utils/uiBuilder');

const memberRoleDebounce = new Map();
const channelCreateDebounce = new Map();
const channelDeleteDebounce = new Map();
const roleCreateDebounce = new Map();
const roleDeleteDebounce = new Map();

// Kanal türünü okunabilir Türkçe'ye çevirir
function channelTypeToTurkish(type) {
    const map = {
        [ChannelType.GuildText]: 'Metin Kanalı',
        [ChannelType.GuildVoice]: 'Ses Kanalı',
        [ChannelType.GuildCategory]: 'Kategori',
        [ChannelType.GuildAnnouncement]: 'Duyuru Kanalı',
        [ChannelType.GuildStageVoice]: 'Sahne Kanalı',
        [ChannelType.GuildForum]: 'Forum Kanalı',
        [ChannelType.GuildMedia]: 'Medya Kanalı',
        [ChannelType.PublicThread]: 'Herkese Açık Konu',
        [ChannelType.PrivateThread]: 'Özel Konu',
        [ChannelType.AnnouncementThread]: 'Duyuru Konusu'
    };
    return map[type] || `Tür: ${type}`;
}

/**
 * Kanal İzin Farklarını Detaylı Olarak Analiz Eder
 */
function getChannelPermissionDiff(oldChannel, newChannel) {
    const oldOverwrites = oldChannel.permissionOverwrites.cache;
    const newOverwrites = newChannel.permissionOverwrites.cache;
    const diffs = [];

    // 1. Eklenen veya Değiştirilen İzinler
    for (const [id, newOw] of newOverwrites) {
        const oldOw = oldOverwrites.get(id);
        const targetName = newOw.type === 0 
            ? (newChannel.guild.roles.cache.get(id)?.name === '@everyone' ? '@everyone' : `<@&${id}>`)
            : `<@${id}>`;

        if (!oldOw) {
            // Yeni hedef izni eklendi
            const allowed = newOw.allow.toArray().map(p => `✅ **${PERMISSION_NAMES_TR[p] || p}:** \`İzin Verildi\``);
            const denied = newOw.deny.toArray().map(p => `❌ **${PERMISSION_NAMES_TR[p] || p}:** \`Engellendi\``);
            const list = [...allowed, ...denied].join('\n');
            diffs.push({
                name: `Özel İzin Tanımlandı: ${targetName}`,
                value: list.length > 0 ? (list.length > 900 ? list.slice(0, 897) + '...' : list) : 'Varsayılan İzinler'
            });
        } else {
            // Var olan izinde değişiklik yapıldı
            const oldAllowed = oldOw.allow.toArray();
            const oldDenied = oldOw.deny.toArray();
            const newAllowed = newOw.allow.toArray();
            const newDenied = newOw.deny.toArray();

            const changes = [];

            // İzin Verilenler (Allow)
            for (const p of newAllowed) {
                if (!oldAllowed.includes(p)) {
                    changes.push(`✅ **${PERMISSION_NAMES_TR[p] || p}:** \`İzin Verildi\``);
                }
            }
            // İzin Kaldırılanlar (Deny)
            for (const p of newDenied) {
                if (!oldDenied.includes(p)) {
                    changes.push(`❌ **${PERMISSION_NAMES_TR[p] || p}:** \`Engellendi / Kapatıldı\``);
                }
            }
            // Nötre Çekilenler (Sıfırlananlar)
            for (const p of oldAllowed) {
                if (!newAllowed.includes(p) && !newDenied.includes(p)) {
                    changes.push(`⚪ **${PERMISSION_NAMES_TR[p] || p}:** \`Varsayılana Sıfırlandı (Nötr)\``);
                }
            }
            for (const p of oldDenied) {
                if (!newAllowed.includes(p) && !newDenied.includes(p)) {
                    changes.push(`⚪ **${PERMISSION_NAMES_TR[p] || p}:** \`Varsayılana Sıfırlandı (Nötr)\``);
                }
            }

            if (changes.length > 0) {
                const text = changes.join('\n');
                diffs.push({
                    name: `İzin Değişikliği: ${targetName}`,
                    value: text.length > 900 ? text.slice(0, 897) + '...' : text
                });
            }
        }
    }

    // 2. Silinen İzinler
    for (const [id, oldOw] of oldOverwrites) {
        if (!newOverwrites.has(id)) {
            const targetName = oldOw.type === 0 
                ? (oldChannel.guild.roles.cache.get(id)?.name === '@everyone' ? '@everyone' : `<@&${id}>`)
                : `<@${id}>`;
            diffs.push({
                name: `Özel İzinler Silindi: ${targetName}`,
                value: 'Kullanıcı/Role ait tüm özel yetkiler kaldırıldı ve sunucu varsayılanına döndürüldü.'
            });
        }
    }

    return diffs;
}

/**
 * Rol İzin Farklarını Detaylı Olarak Analiz Eder
 */
function getRolePermissionDiff(oldRole, newRole) {
    const oldPerms = oldRole.permissions.toArray();
    const newPerms = newRole.permissions.toArray();

    const added = newPerms.filter(p => !oldPerms.includes(p)).map(p => `✅ **${PERMISSION_NAMES_TR[p] || p}:** \`Yetki Verildi\``);
    const removed = oldPerms.filter(p => !newPerms.includes(p)).map(p => `❌ **${PERMISSION_NAMES_TR[p] || p}:** \`Yetki Alındı\``);

    const changes = [...added, ...removed];
    if (changes.length === 0) return null;
    const text = changes.join('\n');
    return text.length > 900 ? text.slice(0, 897) + '...' : text;
}

const sysLogState = new Map();

async function logSystemEvent(guild, title, fields, colorHex = '#2B2D31', category = 'guild', eventName = null, context = {}) {
    let executorField = fields.find(f => f.name.includes('Yetkili') || f.name.includes('Kullanıcı') || f.name.includes('Değiştiren') || f.name.includes('Silen') || f.name.includes('Ekleyen'));
    let executorVal = executorField ? executorField.value : 'System';

    const stateKey = `${guild.id}_${category}_${title}_${executorVal}`;
    const now = Date.now();
    let state = sysLogState.get(stateKey);

    if (state && (now - state.timestamp < 300000) && state.fields.length + fields.length <= 23) {
        state.fields.push({ name: '\u200B', value: '──────────────────' });
        state.fields.push(...fields);
        state.timestamp = now;
        
        const payload = buildModBResponse({ title, fields: state.fields, color: colorHex });
        
        if (state.msgId && state.channelId) {
            const channel = guild.channels.cache.get(state.channelId);
            if (channel) {
                const msg = await channel.messages.fetch(state.msgId).catch(() => null);
                if (msg) {
                    await msg.edit(payload).catch(() => {});
                    return;
                }
            }
        }
    }

    const payload = buildModBResponse({ title, fields, color: colorHex });
    const newMsg = await sendLog(guild, payload, category, eventName, context);
    
    if (newMsg) {
        sysLogState.set(stateKey, {
            fields: [...fields],
            timestamp: now,
            msgId: newMsg.id,
            channelId: newMsg.channelId
        });
    }
}

module.exports = [
{
    name: Events.MessageDelete,
    async execute(message, client) {
        if (!message.guild) return;
        if (message.author?.bot) return;

        // Bot veya AutoMod tarafından silinen mesajları atla
        if (global.botDeletedMessages && global.botDeletedMessages.has(message.id)) {
            global.botDeletedMessages.delete(message.id);
            return;
        }

        const authorId = message.author?.id;
        const authorName = message.author?.tag || 'Bilinmeyen';
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (client?.snipes) {
            client.snipes.set(message.channel.id, {
                content: message.content || '',
                author: message.author || { tag: authorName, id: '0' },
                image: message.attachments?.first()?.proxyURL || null,
                timestamp: Date.now()
            });
        }

        let deletedByText = `${authorName} (Kendi sildi)`;
        let deletedById = authorId || '0';
        let deleteReason = 'Kullanıcı kendi sildi';

        const audit = await resolveAuditExecutor(message.guild, AuditLogEvent.MessageDelete, authorId, 6000);
        if (audit.executor && audit.executor.id !== client.user.id) {
            deletedById = audit.executor.id;
            deletedByText = audit.executorText;
            deleteReason = audit.reason || 'Yetkili tarafından silindi';
        }

        const { pool } = require('../db');
        if (message.content?.trim()) {
            pool.query('INSERT INTO deleted_messages (guild_id, channel_id, user_id, deleted_by, reason, content) VALUES (?, ?, ?, ?, ?, ?)',
                [message.guild.id, message.channel.id, authorId || '0', deletedById, deleteReason, message.content.slice(0, 2000)]).catch(() => {});
        }

        const fields = [
            { name: 'Mesaj Sahibi', value: `<@${authorId || '0'}> (\`${authorName}\`)` },
            { name: 'Silen Kişi', value: deletedByText },
            { name: 'Kanal', value: `<#${message.channel.id}>` },
            { name: 'Silme Sebebi', value: deleteReason },
            { name: 'Zaman', value: now },
            { name: 'Mesaj ID', value: `\`${message.id}\`` }
        ];

        if (message.content?.trim()) {
            let txt = message.content.replace(/```/g, '\\`\\`\\`');
            if (txt.length > 900) txt = txt.slice(0, 897) + '...';
            fields.push({ name: 'Silinen İçerik', value: `\`\`\`\n${txt}\n\`\`\`` });
        }

        if (message.attachments?.size > 0) {
            const attachList = message.attachments.map(a => `${a.name} (${a.contentType || 'dosya'})`).join(', ');
            fields.push({ name: 'Ekler', value: attachList });
        }

        if (message.mentions?.users?.size > 0) {
            fields.push({ name: 'Ghost Ping Uyarısı', value: 'Etiket içeren mesaj silindi!' });
        }

        logSystemEvent(message.guild, 'Mesaj Silindi', fields, '#2B2D31', 'message', 'msg_delete', { channelId: message.channel.id, userId: authorId, isBot: message.author?.bot });
    }
},
{
    name: Events.MessageUpdate,
    execute(oldMessage, newMessage) {
        if (!oldMessage.guild) return;
        if (oldMessage.author?.bot || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const authorName = oldMessage.author?.tag || 'Bilinmeyen';
        const authorMention = oldMessage.author ? `<@${oldMessage.author.id}>` : 'Bilinmeyen';
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let oldText = (oldMessage.content || '*[içerik yok]*').replace(/```/g, '\\`\\`\\`');
        if (oldText.length > 900) oldText = oldText.slice(0, 897) + '...';
        let newText = (newMessage.content || '*[içerik yok]*').replace(/```/g, '\\`\\`\\`');
        if (newText.length > 900) newText = newText.slice(0, 897) + '...';

        const fields = [
            { name: 'Mesaj Sahibi', value: `${authorMention} (\`${authorName}\`)` },
            { name: 'Kanal', value: `<#${oldMessage.channel.id}>` },
            { name: 'Zaman', value: now },
            { name: 'Eski İçerik', value: `\`\`\`\n${oldText}\n\`\`\`` },
            { name: 'Yeni İçerik', value: `\`\`\`\n${newText}\n\`\`\`` },
            { name: 'Bağlantı', value: `[Mesaja Git](${newMessage.url})` }
        ];

        logSystemEvent(oldMessage.guild, 'Mesaj Düzenlendi', fields, '#2B2D31', 'message', 'msg_edit', { channelId: oldMessage.channel.id, userId: oldMessage.author?.id, isBot: oldMessage.author?.bot });
    }
},
{
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        if (!oldMember.guild) return;

        // 1. İsim (Nickname) Değişimi
        if (oldMember.nickname !== newMember.nickname) {
            const audit = await resolveAuditExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const oldName = oldMember.nickname || oldMember.user.username;
            const newName = newMember.nickname || newMember.user.username;
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const fields = [
                { name: 'Üye', value: `<@${newMember.id}> (\`${escapeMarkdown(newMember.user.tag)}\`)` },
                { name: 'Eski İsim', value: `\`${escapeMarkdown(oldName)}\`` },
                { name: 'Yeni İsim', value: `\`${escapeMarkdown(newName)}\`` },
                { name: 'Değiştiren', value: audit.executorText !== 'Bilinmiyor / Discord' ? audit.executorText : `<@${newMember.id}> (Kendisi)` },
                { name: 'Zaman', value: now }
            ];
            logSystemEvent(newMember.guild, 'İsim (Nickname) Değiştirildi', fields, '#2B2D31', 'member', 'member_nick_change', { userId: newMember.id, isBot: newMember.user?.bot });
            
            const { pool } = require('../db');
            pool.query('INSERT INTO user_history (user_id, guild_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [newMember.id, newMember.guild.id, 'nickname', oldName, newName]).catch(()=>{});
        }
        
        // 2. Sunucu Profili (Avatar / PP) Değişimi
        if (oldMember.avatar !== newMember.avatar) {
            const oldAvatar = oldMember.avatarURL({ extension: 'png', size: 1024 }) || oldMember.user.displayAvatarURL({ extension: 'png', size: 1024 });
            const newAvatar = newMember.avatarURL({ extension: 'png', size: 1024 }) || newMember.user.displayAvatarURL({ extension: 'png', size: 1024 });
            
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Üye', value: `<@${newMember.id}> (\`${escapeMarkdown(newMember.user.tag)}\`)` },
                { name: 'Değişiklik', value: 'Sunucu Özel Profil Fotoğrafı (Server Avatar)' },
                { name: 'Eski Fotoğraf', value: oldAvatar ? `[Görüntüle / İndir (1024px)](${oldAvatar})` : 'Varsayılan Avatar' },
                { name: 'Yeni Fotoğraf', value: newAvatar ? `[Görüntüle / İndir (1024px)](${newAvatar})` : 'Varsayılan Avatar' },
                { name: 'Zaman', value: now }
            ];
            logSystemEvent(newMember.guild, 'Sunucu Profil Fotoğrafı Güncellendi', fields, '#2B2D31', 'member', 'user_avatar_change', { userId: newMember.id, isBot: newMember.user?.bot });
            
            const { pool } = require('../db');
            pool.query('INSERT INTO user_history (user_id, guild_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [newMember.id, newMember.guild.id, 'server_avatar', oldAvatar, newAvatar]).catch(()=>{});
        }

        // 3. Sunucu Profili (Banner) Değişimi
        if (oldMember.banner !== newMember.banner) {
            const oldBanner = oldMember.bannerURL({ size: 1024 });
            const newBanner = newMember.bannerURL({ size: 1024 });

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Üye', value: `<@${newMember.id}> (\`${escapeMarkdown(newMember.user.tag)}\`)` },
                { name: 'Değişiklik', value: 'Sunucu Profil Bannerı (Server Banner)' },
                { name: 'Eski Banner', value: oldBanner ? `[Görüntüle / İndir (1024px)](${oldBanner})` : 'Yok' },
                { name: 'Yeni Banner', value: newBanner ? `[Görüntüle / İndir (1024px)](${newBanner})` : 'Yok' },
                { name: 'Zaman', value: now }
            ];
            logSystemEvent(newMember.guild, 'Sunucu Bannerı Güncellendi', fields, '#2B2D31', 'member', 'user_banner_change', { userId: newMember.id, isBot: newMember.user?.bot });

            const { pool } = require('../db');
            pool.query('INSERT INTO user_history (user_id, guild_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [newMember.id, newMember.guild.id, 'server_banner', oldBanner || '', newBanner || '']).catch(()=>{});
        }

        // 4. Rol Değişimleri
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            if (addedRoles.size > 0 || removedRoles.size > 0) {
                if (!memberRoleDebounce.has(newMember.id)) {
                    memberRoleDebounce.set(newMember.id, { added: new Set(), removed: new Set(), timeout: null });
                }
                const data = memberRoleDebounce.get(newMember.id);
                addedRoles.forEach(r => data.added.add(r.id));
                removedRoles.forEach(r => data.removed.add(r.id));

                if (data.timeout) clearTimeout(data.timeout);
                data.timeout = setTimeout(async () => {
                    memberRoleDebounce.delete(newMember.id);

                    const audit = await resolveAuditExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
                    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const fields = [
                        { name: 'Üye', value: `<@${newMember.id}> (\`${newMember.user.tag}\`)` },
                        { name: 'İşlem Yapan Yetkili', value: audit.executorText },
                        { name: 'Zaman', value: now }
                    ];

                    if (data.added.size > 0) {
                        fields.push({ name: 'Verilen Roller', value: Array.from(data.added).map(id => `<@&${id}>`).join(', ') });
                    }
                    if (data.removed.size > 0) {
                        fields.push({ name: 'Alınan Roller', value: Array.from(data.removed).map(id => `<@&${id}>`).join(', ') });
                    }

                    logSystemEvent(newMember.guild, 'Roller Güncellendi', fields, '#2B2D31', 'member', data.added.size > 0 ? 'member_role_add' : 'member_role_remove', { userId: newMember.id, roleIds: Array.from([...data.added, ...data.removed]), isBot: newMember.user?.bot });
                }, 1500);
            }
        }
    }
},
{
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;
        const guildId = channel.guild.id;
        if (!channelCreateDebounce.has(guildId)) channelCreateDebounce.set(guildId, { items: [], timeout: null });
        const data = channelCreateDebounce.get(guildId);
        data.items.push(channel);
        if (data.timeout) clearTimeout(data.timeout);
        data.timeout = setTimeout(async () => {
            channelCreateDebounce.delete(guildId);

            const audit = await resolveAuditExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
            const voiceChannels = data.items.filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice);
            const otherChannels = data.items.filter(ch => ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice);

            if (otherChannels.length > 0) {
                const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const fields = [
                    { name: 'Oluşturan Yetkili', value: audit.executorText },
                    { name: 'Zaman', value: now }
                ];
                otherChannels.slice(0, 50).forEach(ch => {
                    const parentInfo = ch.parent ? ` | Kategori: \`${ch.parent.name}\`` : '';
                    fields.push({ name: 'Yeni Kanal', value: `<#${ch.id}> (\`${ch.name}\`) | Tür: ${channelTypeToTurkish(ch.type)}${parentInfo}` });
                });
                const title = otherChannels.length > 1 ? `Toplu ${otherChannels.length} Kanal Oluşturuldu` : 'Yeni Kanal Oluşturuldu';
                logSystemEvent(channel.guild, title, fields, '#2B2D31', 'channel_ops', 'channel_create');
            }

            for (const ch of voiceChannels) {
                const parentInfo = ch.parent ? ` (Kategori: ${escapeMarkdown(ch.parent.name)})` : '';
                await sendVoiceLog(channel.client, channel.guild.id, 'Ses Kanalı Oluşturuldu', `${audit.executorText} tarafından <#${ch.id}> adlı yeni ses kanalı oluşturuldu.${parentInfo}`, audit.executorText, 'global');
            }
        }, 2000);
    }
},
{
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild) return;
        const guildId = channel.guild.id;
        if (!channelDeleteDebounce.has(guildId)) channelDeleteDebounce.set(guildId, { items: [], timeout: null });
        const data = channelDeleteDebounce.get(guildId);
        data.items.push({ name: channel.name, type: channel.type, id: channel.id, parentName: channel.parent?.name || null, guild: channel.guild });
        if (data.timeout) clearTimeout(data.timeout);
        data.timeout = setTimeout(async () => {
            channelDeleteDebounce.delete(guildId);

            const audit = await resolveAuditExecutor(data.items[0].guild, AuditLogEvent.ChannelDelete, data.items[0].id);
            const voiceChannels = data.items.filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice);
            const otherChannels = data.items.filter(ch => ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice);

            if (otherChannels.length > 0) {
                const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const fields = [
                    { name: 'Silen Yetkili', value: audit.executorText },
                    { name: 'Sebep', value: audit.reason || 'Belirtilmedi' },
                    { name: 'Zaman', value: now }
                ];
                otherChannels.slice(0, 50).forEach(ch => {
                    const parentInfo = ch.parentName ? ` | Kategori: \`${ch.parentName}\`` : '';
                    fields.push({ name: 'Silinen Kanal', value: `İsim: \`${escapeMarkdown(ch.name)}\` | Tür: ${channelTypeToTurkish(ch.type)} | ID: \`${ch.id}\`${parentInfo}` });
                });
                const title = otherChannels.length > 1 ? `Toplu ${otherChannels.length} Kanal Silindi` : 'Kanal Silindi';
                logSystemEvent(data.items[0].guild, title, fields, '#2B2D31', 'channel_ops', 'channel_delete');
            }

            for (const ch of voiceChannels) {
                const parentInfo = ch.parentName ? ` (Kategori: ${escapeMarkdown(ch.parentName)})` : '';
                await sendVoiceLog(data.items[0].guild.client, data.items[0].guild.id, 'Ses Kanalı Silindi', `${audit.executorText} tarafından **${escapeMarkdown(ch.name)}** adlı ses kanalı silindi.${parentInfo} Sebep: ${escapeMarkdown(audit.reason || 'Belirtilmedi')}`, audit.executorText, 'global');
            }
        }, 2000);
    }
},
{
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!oldChannel.guild) return;

        const changes = [];
        if (oldChannel.name !== newChannel.name) changes.push({ name: 'İsim Değişikliği', value: `\`${escapeMarkdown(oldChannel.name)}\` → \`${escapeMarkdown(newChannel.name)}\`` });
        if (oldChannel.topic !== newChannel.topic) changes.push({ name: 'Konu Değişikliği', value: `Eski: \`${escapeMarkdown(oldChannel.topic || 'Yok')}\`\nYeni: \`${escapeMarkdown(newChannel.topic || 'Yok')}\`` });
        if (oldChannel.nsfw !== newChannel.nsfw) changes.push({ name: 'NSFW Durumu', value: `${oldChannel.nsfw ? 'Açık' : 'Kapalı'} → ${newChannel.nsfw ? 'Açık' : 'Kapalı'}` });
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push({ name: 'Yavaş Mod', value: `${oldChannel.rateLimitPerUser || 0}sn → ${newChannel.rateLimitPerUser || 0}sn` });
        if (oldChannel.bitrate !== newChannel.bitrate) changes.push({ name: 'Bit Hızı', value: `${Math.floor((oldChannel.bitrate || 0) / 1000)}kbps → ${Math.floor((newChannel.bitrate || 0) / 1000)}kbps` });
        if (oldChannel.userLimit !== newChannel.userLimit) changes.push({ name: 'Kişi Limiti', value: `${oldChannel.userLimit || 'Sınırsız'} → ${newChannel.userLimit || 'Sınırsız'}` });
        if (oldChannel.parentId !== newChannel.parentId) changes.push({ name: 'Kategori Değişti', value: `\`${oldChannel.parent?.name || 'Yok'}\` → \`${newChannel.parent?.name || 'Yok'}\`` });

        // DETAYLI KANAL İZİN DEĞİŞİKLİKLERİ
        if (!oldChannel.permissionOverwrites.cache.equals(newChannel.permissionOverwrites.cache)) {
            const permDiffs = getChannelPermissionDiff(oldChannel, newChannel);
            if (permDiffs.length > 0) {
                changes.push(...permDiffs);
            } else {
                changes.push({ name: 'İzinler', value: 'Kanal yetkilerinde güncelleme yapıldı.' });
            }
        }

        if (changes.length === 0) return;

        const audit = await resolveAuditExecutor(newChannel.guild, [
            AuditLogEvent.ChannelUpdate,
            AuditLogEvent.ChannelOverwriteCreate,
            AuditLogEvent.ChannelOverwriteUpdate,
            AuditLogEvent.ChannelOverwriteDelete
        ], newChannel.id);

        if (audit.executor && audit.executor.id === newChannel.client.user.id) {
            return; // Botun kendi güncellemelerini çift loglama
        }

        const isVoice = newChannel.type === ChannelType.GuildVoice || newChannel.type === ChannelType.GuildStageVoice;
        
        if (isVoice) {
            const changeDesc = changes.map(c => `**${c.name}:** ${c.value}`).join(' | ');
            await sendVoiceLog(newChannel.client, newChannel.guild.id, 'Ses Kanalı Güncellendi', `${audit.executorText} tarafından <#${newChannel.id}> kanalında değişiklik yapıldı:\n${changeDesc}`, audit.executorText, `room:${newChannel.id}`);
        } else {
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Kanal', value: `<#${newChannel.id}> (\`${newChannel.name}\`)` },
                { name: 'Tür', value: channelTypeToTurkish(newChannel.type) },
                { name: 'Değiştiren Yetkili', value: audit.executorText },
                { name: 'Zaman', value: now },
                ...changes
            ];

            logSystemEvent(newChannel.guild, 'Kanal Güncellendi', fields, '#2B2D31', 'channel_ops', 'channel_update');
        }
    }
},
{
    name: Events.GuildRoleCreate,
    async execute(role) {
        if (!role.guild) return;
        const guildId = role.guild.id;
        if (!roleCreateDebounce.has(guildId)) roleCreateDebounce.set(guildId, { items: [], timeout: null });
        const data = roleCreateDebounce.get(guildId);
        data.items.push(role);
        if (data.timeout) clearTimeout(data.timeout);
        data.timeout = setTimeout(async () => {
            roleCreateDebounce.delete(guildId);

            const audit = await resolveAuditExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Oluşturan Yetkili', value: audit.executorText },
                { name: 'Zaman', value: now }
            ];
            data.items.slice(0, 50).forEach(r => {
                const colorHex = r.hexColor !== '#000000' ? ` | Renk: ${r.hexColor}` : '';
                fields.push({ name: 'Yeni Rol', value: `<@&${r.id}> (\`${r.name}\`) | ID: \`${r.id}\`${colorHex}` });
            });
            const title = data.items.length > 1 ? `Toplu ${data.items.length} Rol Oluşturuldu` : 'Yeni Rol Oluşturuldu';
            logSystemEvent(role.guild, title, fields, '#2B2D31', 'role', 'role_create', { roleIds: [role.id] });
        }, 2000);
    }
},
{
    name: Events.GuildRoleDelete,
    async execute(role) {
        if (!role.guild) return;
        const guildId = role.guild.id;
        if (!roleDeleteDebounce.has(guildId)) roleDeleteDebounce.set(guildId, { items: [], timeout: null });
        const data = roleDeleteDebounce.get(guildId);
        data.items.push(role);
        if (data.timeout) clearTimeout(data.timeout);
        data.timeout = setTimeout(async () => {
            roleDeleteDebounce.delete(guildId);

            const audit = await resolveAuditExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Silen Yetkili', value: audit.executorText },
                { name: 'Sebep', value: audit.reason || 'Belirtilmedi' },
                { name: 'Zaman', value: now }
            ];
            data.items.slice(0, 50).forEach(r => {
                fields.push({ name: 'Silinen Rol', value: `İsim: \`${r.name}\` | ID: \`${r.id}\`` });
            });
            const title = data.items.length > 1 ? `Toplu ${data.items.length} Rol Silindi` : 'Rol Silindi';
            logSystemEvent(role.guild, title, fields, '#2B2D31', 'role', 'role_delete', { roleIds: [role.id] });
        }, 2000);
    }
},
{
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
        if (!oldRole.guild) return;

        const changes = [];
        if (oldRole.name !== newRole.name) changes.push({ name: 'İsim', value: `\`${escapeMarkdown(oldRole.name)}\` → \`${escapeMarkdown(newRole.name)}\`` });
        if (oldRole.hexColor !== newRole.hexColor) changes.push({ name: 'Renk', value: `${oldRole.hexColor} → ${newRole.hexColor}` });
        if (oldRole.hoist !== newRole.hoist) changes.push({ name: 'Ayrı Gösterim', value: `${oldRole.hoist ? 'Açık' : 'Kapalı'} → ${newRole.hoist ? 'Açık' : 'Kapalı'}` });
        if (oldRole.mentionable !== newRole.mentionable) changes.push({ name: 'Etiketlenebilir', value: `${oldRole.mentionable ? 'Evet' : 'Hayır'} → ${newRole.mentionable ? 'Evet' : 'Hayır'}` });

        // DETAYLI ROL İZİN DEĞİŞİKLİKLERİ
        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            const rolePermDiff = getRolePermissionDiff(oldRole, newRole);
            if (rolePermDiff) {
                changes.push({ name: 'Yetki Güncellemeleri', value: rolePermDiff });
            }
        }

        if (changes.length === 0) return;

        const audit = await resolveAuditExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Rol', value: `<@&${newRole.id}> (\`${newRole.name}\`)` },
            { name: 'Değiştiren Yetkili', value: audit.executorText },
            { name: 'Zaman', value: now },
            ...changes
        ];

        logSystemEvent(newRole.guild, 'Rol Güncellendi', fields, '#2B2D31', 'role', 'role_update', { roleIds: [newRole.id] });
    }
},
{
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        if (!ban.guild) return;

        const audit = await resolveAuditExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Yasaklanan Kullanıcı', value: `<@${ban.user.id}> (\`${escapeMarkdown(ban.user.tag)}\`)` },
            { name: 'Kullanıcı ID', value: `\`${ban.user.id}\`` },
            { name: 'Yasaklayan Yetkili', value: audit.executorText },
            { name: 'Sebep', value: escapeMarkdown(audit.reason || 'Belirtilmedi') },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(ban.guild, 'Kullanıcı Yasaklandı (Ban)', fields, '#2B2D31', 'ban', 'ban_add', { userId: ban.user.id });
    }
},
{
    name: Events.GuildBanRemove,
    async execute(ban, client) {
        if (!ban.guild) return;

        const audit = await resolveAuditExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kullanıcı', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)` },
            { name: 'Kullanıcı ID', value: `\`${ban.user.id}\`` },
            { name: 'Yasağı Kaldıran', value: audit.executorText },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(ban.guild, 'Yasaklama (Ban) Kaldırıldı', fields, '#2B2D31', 'ban', 'ban_remove', { userId: ban.user.id });
    }
},
{
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        if (!member.guild || member.user.bot) return;

        let action = 'Sunucudan Ayrıldı';
        let isKick = false;

        const kickAudit = await resolveAuditExecutor(member.guild, AuditLogEvent.MemberKick, member.id, 6000);
        if (kickAudit.executor) {
            action = 'Sunucudan Atıldı (Kick)';
            isKick = true;
        }

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Rol yok';
        const joinedAt = member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Bilinmiyor';

        const fields = [
            { name: 'Kullanıcı', value: `<@${member.id}> (\`${escapeMarkdown(member.user.tag)}\`)` },
            { name: 'Kullanıcı ID', value: `\`${member.id}\`` },
            { name: 'Katılma Tarihi', value: joinedAt },
            { name: 'Rolleri', value: roles.length > 900 ? roles.slice(0, 897) + '...' : roles },
            { name: 'Zaman', value: now }
        ];

        if (isKick) {
            fields.splice(2, 0, { name: 'Atan Yetkili', value: kickAudit.executorText });
            fields.splice(3, 0, { name: 'Sebep', value: escapeMarkdown(kickAudit.reason || 'Belirtilmedi') });
        }

        logSystemEvent(member.guild, action, fields, '#2B2D31', isKick ? 'kick' : 'member', isKick ? 'member_kick' : 'member_leave', { userId: member.id, isBot: member.user?.bot });
    }
},
{
    name: Events.InviteCreate,
    async execute(invite, context) {
        if (!invite.guild) return;

        const inviter = invite.inviter ? `<@${invite.inviter.id}> (\`${invite.inviter.tag}\`)` : 'Bilinmiyor';
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: invite.channel ? `<#${invite.channel.id}>` : 'Bilinmiyor' },
            { name: 'Oluşturan', value: inviter },
            { name: 'Davet Kodu', value: `\`${invite.code}\`` },
            { name: 'Süre', value: invite.maxAge ? `${invite.maxAge} saniye` : 'Süresiz' },
            { name: 'Maksimum Kullanım', value: invite.maxUses ? `${invite.maxUses} kez` : 'Sınırsız' },
            { name: 'Geçici Üyelik', value: invite.temporary ? 'Evet' : 'Hayır' },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(invite.guild, 'Yeni Davet Bağlantısı Oluşturuldu', fields, '#2B2D31', 'invite', 'invite_create');
    }
},
{
    name: Events.InviteDelete,
    async execute(invite, context) {
        if (!invite.guild) return;

        const audit = await resolveAuditExecutor(invite.guild, AuditLogEvent.InviteDelete);
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: invite.channel ? `<#${invite.channel.id}>` : 'Bilinmiyor' },
            { name: 'Davet Kodu', value: `\`${invite.code}\`` },
            { name: 'Silen', value: audit.executorText },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(invite.guild, 'Davet Bağlantısı Silindi', fields, '#2B2D31', 'invite', 'invite_delete');
    }
},
{
    name: Events.WebhooksUpdate,
    async execute(channel) {
        if (!channel.guild) return;

        const audit = await resolveAuditExecutor(channel.guild, [
            AuditLogEvent.WebhookCreate,
            AuditLogEvent.WebhookUpdate,
            AuditLogEvent.WebhookDelete
        ], channel.id);

        let action = 'Güncellendi';
        if (audit.entry?.action === AuditLogEvent.WebhookCreate) action = 'Oluşturuldu';
        else if (audit.entry?.action === AuditLogEvent.WebhookDelete) action = 'Silindi';

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: `<#${channel.id}> (\`${escapeMarkdown(channel.name)}\`)` },
            { name: 'İşlem Yapan', value: audit.executorText },
            { name: 'Aksiyon', value: action },
            { name: 'Zaman', value: now }
        ];
        logSystemEvent(channel.guild, 'Webhook Güncellemesi', fields, '#2B2D31', 'guild', 'webhook_ops', { channelId: channel.id });
    }
},
{
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        const audit = await resolveAuditExecutor(newGuild, AuditLogEvent.GuildUpdate);
        const changes = [];
        if (oldGuild.name !== newGuild.name) changes.push({ name: 'Sunucu Adı', value: `\`${escapeMarkdown(oldGuild.name)}\` → \`${escapeMarkdown(newGuild.name)}\`` });
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push({ name: 'Özel URL (Vanity)', value: `\`${oldGuild.vanityURLCode || 'Yok'}\` → \`${newGuild.vanityURLCode || 'Yok'}\`` });
        if (oldGuild.description !== newGuild.description) changes.push({ name: 'Sunucu Açıklaması', value: `\`${escapeMarkdown(oldGuild.description || 'Yok')}\` → \`${escapeMarkdown(newGuild.description || 'Yok')}\`` });
        if (oldGuild.icon !== newGuild.icon) {
            const oldIcon = oldGuild.iconURL({ extension: 'png', size: 1024 });
            const newIcon = newGuild.iconURL({ extension: 'png', size: 1024 });
            changes.push({ name: 'Sunucu İkonu', value: `Eski: ${oldIcon ? `[Görüntüle](${oldIcon})` : 'Yok'}\nYeni: ${newIcon ? `[Görüntüle](${newIcon})` : 'Yok'}` });
        }
        if (oldGuild.banner !== newGuild.banner) {
            const oldBanner = oldGuild.bannerURL({ size: 1024 });
            const newBanner = newGuild.bannerURL({ size: 1024 });
            changes.push({ name: 'Sunucu Bannerı', value: `Eski: ${oldBanner ? `[Görüntüle](${oldBanner})` : 'Yok'}\nYeni: ${newBanner ? `[Görüntüle](${newBanner})` : 'Yok'}` });
        }
        if (oldGuild.splash !== newGuild.splash) {
            const oldSplash = oldGuild.splashURL({ size: 1024 });
            const newSplash = newGuild.splashURL({ size: 1024 });
            changes.push({ name: 'Davet Splash Görseli', value: `Eski: ${oldSplash ? `[Görüntüle](${oldSplash})` : 'Yok'}\nYeni: ${newSplash ? `[Görüntüle](${newSplash})` : 'Yok'}` });
        }
        
        if (changes.length === 0) return;
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Değiştiren Yetkili', value: audit.executorText },
            { name: 'Zaman', value: now },
            ...changes
        ];
        const isVisualOnly = changes.every(c => c.name.includes('İkon') || c.name.includes('Banner') || c.name.includes('Splash'));
        logSystemEvent(newGuild, 'Sunucu Ayarları Güncellendi', fields, '#2B2D31', 'guild', isVisualOnly ? 'guild_icon' : 'guild_update');
    }
},
{
    name: Events.EmojiCreate,
    async execute(emoji) {
        const audit = await resolveAuditExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logSystemEvent(emoji.guild, 'Emoji Eklendi', [
            { name: 'Ekleyen Yetkili', value: audit.executorText },
            { name: 'Emoji', value: `${emoji} (\`${emoji.name}\`)` },
            { name: 'Zaman', value: now }
        ], '#2B2D31', 'guild', 'emoji_create');
    }
},
{
    name: Events.EmojiDelete,
    async execute(emoji) {
        const audit = await resolveAuditExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logSystemEvent(emoji.guild, 'Emoji Silindi', [
            { name: 'Silen Yetkili', value: audit.executorText },
            { name: 'Emoji Adı', value: `\`${emoji.name}\`` },
            { name: 'Zaman', value: now }
        ], '#2B2D31', 'guild', 'emoji_delete');
    }
},
{
    name: Events.UserUpdate,
    async execute(oldUser, newUser, client) {
        if (oldUser.bot) return;

        // 1. Global Avatar (PP) Değişimi
        if (oldUser.avatar !== newUser.avatar) {
            const oldAvatar = oldUser.displayAvatarURL({ extension: 'png', size: 1024, forceStatic: false });
            const newAvatar = newUser.displayAvatarURL({ extension: 'png', size: 1024, forceStatic: false });

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Kullanıcı', value: `<@${newUser.id}> (\`${newUser.tag}\`)` },
                { name: 'Değişiklik', value: 'Global Profil Fotoğrafı (Avatar / PP)' },
                { name: 'Eski Profil Fotoğrafı', value: oldAvatar ? `[Görüntüle / İndir (1024px)](${oldAvatar})` : 'Varsayılan Avatar' },
                { name: 'Yeni Profil Fotoğrafı', value: newAvatar ? `[Görüntüle / İndir (1024px)](${newAvatar})` : 'Varsayılan Avatar' },
                { name: 'Zaman', value: now }
            ];

            const { pool } = require('../db');
            pool.query('INSERT INTO user_history (user_id, guild_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [newUser.id, null, 'global_avatar', oldAvatar, newAvatar]).catch(()=>{});

            for (const guild of client.guilds.cache.values()) {
                if (guild.members.cache.has(newUser.id)) {
                    logSystemEvent(guild, 'Kullanıcı Profil Fotoğrafı Güncellendi', fields, '#2B2D31', 'member', 'user_avatar_change', { userId: newUser.id, isBot: newUser.bot });
                }
            }
        }

        // 2. Global Banner Değişimi
        if (oldUser.banner !== newUser.banner) {
            const oldBanner = oldUser.bannerURL({ size: 1024 });
            const newBanner = newUser.bannerURL({ size: 1024 });

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Kullanıcı', value: `<@${newUser.id}> (\`${newUser.tag}\`)` },
                { name: 'Değişiklik', value: 'Global Profil Bannerı' },
                { name: 'Eski Banner', value: oldBanner ? `[Görüntüle / İndir (1024px)](${oldBanner})` : 'Yok' },
                { name: 'Yeni Banner', value: newBanner ? `[Görüntüle / İndir (1024px)](${newBanner})` : 'Yok' },
                { name: 'Zaman', value: now }
            ];

            const { pool } = require('../db');
            pool.query('INSERT INTO user_history (user_id, guild_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [newUser.id, null, 'banner', oldBanner || '', newBanner || '']).catch(()=>{});

            for (const guild of client.guilds.cache.values()) {
                if (guild.members.cache.has(newUser.id)) {
                    logSystemEvent(guild, 'Kullanıcı Bannerı Güncellendi', fields, '#2B2D31', 'member', 'user_banner_change', { userId: newUser.id, isBot: newUser.bot });
                }
            }
        }

        // 3. Global Username / Tag Değişimi
        if (oldUser.username !== newUser.username || oldUser.discriminator !== newUser.discriminator) {
            const oldName = oldUser.tag;
            const newName = newUser.tag;

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Kullanıcı', value: `<@${newUser.id}>` },
                { name: 'Eski Kullanıcı Adı', value: `\`${oldName}\`` },
                { name: 'Yeni Kullanıcı Adı', value: `\`${newName}\`` },
                { name: 'Zaman', value: now }
            ];

            const { pool } = require('../db');
            pool.query('INSERT INTO user_history (user_id, guild_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [newUser.id, null, 'username', oldName, newName]).catch(()=>{});

            for (const guild of client.guilds.cache.values()) {
                if (guild.members.cache.has(newUser.id)) {
                    logSystemEvent(guild, 'Kullanıcı Adı (Global) Değiştirildi', fields, '#2B2D31', 'member', 'user_name_change', { userId: newUser.id, isBot: newUser.bot });
                }
            }
        }
    }
}
];