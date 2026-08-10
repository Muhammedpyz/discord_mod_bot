const { Events, AuditLogEvent, ChannelType, escapeMarkdown } = require('discord.js');
const { sendLog, sendVoiceLog } = require('../utils/logger');
const { buildModBResponse } = require('../utils/uiBuilder');

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

const sysLogState = new Map();

async function logSystemEvent(guild, title, fields, colorHex = '#2B2D31', logType = 'system') {
    let executorField = fields.find(f => f.name.includes('Yetkili') || f.name.includes('Kullanıcı') || f.name.includes('Değiştiren') || f.name.includes('Silen'));
    let executorVal = executorField ? executorField.value : 'System';

    const stateKey = `${guild.id}_${logType}_${title}_${executorVal}`;
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
    const newMsg = await sendLog(guild, payload, logType);
    
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

        let deletedById = authorId || message.guild.id;
        let deleteReason = 'Kullanıcı kendi sildi';

        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete }).catch(() => null);
            if (fetchedLogs) {
                const deletionLog = fetchedLogs.entries.first();
                if (deletionLog) {
                    const { executor, target, extra, createdTimestamp, reason } = deletionLog;
                    const isMatch = (authorId && target?.id === authorId) || (!authorId && extra?.channel?.id === message.channel.id);
                    if (isMatch && (Date.now() - createdTimestamp < 10000)) {
                        deletedById = executor.id;
                        deleteReason = reason || 'Yetkili tarafından silindi';
                    }
                }
            }
        } catch (e) {}

        const { pool } = require('../db');
        if (message.content?.trim()) {
            pool.query('INSERT INTO deleted_messages (guild_id, channel_id, user_id, deleted_by, reason, content) VALUES (?, ?, ?, ?, ?, ?)',
                [message.guild.id, message.channel.id, authorId || '0', deletedById, deleteReason, message.content.slice(0, 2000)]).catch(() => {});
        }

        const fields = [
            { name: 'Mesaj Sahibi', value: `<@${authorId || '0'}> (${authorName})` },
            { name: 'Silen Kişi', value: deletedById !== authorId && deletedById !== '0' ? `<@${deletedById}>` : `${authorName} (Kendi sildi)` },
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

        logSystemEvent(message.guild, 'Mesaj Silindi', fields, '#2B2D31', 'text');
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
            { name: 'Mesaj Sahibi', value: `${authorMention} (${authorName})` },
            { name: 'Kanal', value: `<#${oldMessage.channel.id}>` },
            { name: 'Zaman', value: now },
            { name: 'Eski İçerik', value: `\`\`\`\n${oldText}\n\`\`\`` },
            { name: 'Yeni İçerik', value: `\`\`\`\n${newText}\n\`\`\`` },
            { name: 'Bağlantı', value: `[Mesaja Git](${newMessage.url})` }
        ];

        logSystemEvent(oldMessage.guild, 'Mesaj Düzenlendi', fields, '#2B2D31');
    }
},
{
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        if (!oldMember.guild) return;

        if (oldMember.nickname !== newMember.nickname) {
            let executorId = 'Bilinmiyor';
            try {
                const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
                const log = fetchedLogs.entries.first();
                if (log && log.target.id === newMember.id && Date.now() - log.createdTimestamp < 10000) {
                    executorId = `<@${log.executor.id}>`;
                }
            } catch (e) {}

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Üye', value: `<@${newMember.id}> (\`${escapeMarkdown(newMember.user.tag)}\`)` },
                { name: 'Eski İsim', value: `\`${escapeMarkdown(oldMember.nickname || oldMember.user.username)}\`` },
                { name: 'Yeni İsim', value: `\`${escapeMarkdown(newMember.nickname || newMember.user.username)}\`` },
                { name: 'Değiştiren', value: executorId },
                { name: 'Zaman', value: now }
            ];
            logSystemEvent(newMember.guild, 'İsim (Nickname) Değiştirildi', fields, '#2B2D31');
        }

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

                    let executorId = 'Bilinmiyor';
                    try {
                        const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
                        const log = fetchedLogs.entries.first();
                        if (log && log.target.id === newMember.id && Date.now() - log.createdTimestamp < 10000) {
                            executorId = `<@${log.executor.id}>`;
                        }
                    } catch (e) {}

                    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const fields = [
                        { name: 'Üye', value: `<@${newMember.id}> (\`${newMember.user.tag}\`)` },
                        { name: 'Değiştiren', value: executorId },
                        { name: 'Zaman', value: now }
                    ];

                    if (data.added.size > 0) {
                        fields.push({ name: 'Verilen Roller', value: Array.from(data.added).map(id => `<@&${id}>`).join(', ') });
                    }
                    if (data.removed.size > 0) {
                        fields.push({ name: 'Alınan Roller', value: Array.from(data.removed).map(id => `<@&${id}>`).join(', ') });
                    }

                    logSystemEvent(newMember.guild, 'Roller Güncellendi', fields, '#2B2D31');
                }, 2000);
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

            let executorId = 'Bilinmiyor';
            try {
                const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: Math.min(data.items.length, 10), type: AuditLogEvent.ChannelCreate });
                const log = fetchedLogs.entries.first();
                if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}>`;
            } catch (e) {}

            const voiceChannels = data.items.filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice);
            const otherChannels = data.items.filter(ch => ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice);

            if (otherChannels.length > 0) {
                const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const fields = [
                    { name: 'Oluşturan Yetkili', value: executorId },
                    { name: 'Zaman', value: now }
                ];
                otherChannels.slice(0, 50).forEach(ch => {
                    const parentInfo = ch.parent ? ` | Kategori: \`${ch.parent.name}\`` : '';
                    fields.push({ name: 'Yeni Kanal', value: `<#${ch.id}> (\`${ch.name}\`) | Tür: ${channelTypeToTurkish(ch.type)}${parentInfo}` });
                });
                const title = otherChannels.length > 1 ? `Toplu ${otherChannels.length} Kanal Oluşturuldu` : 'Yeni Kanal Oluşturuldu';
                logSystemEvent(channel.guild, title, fields, '#2B2D31');
            }

            for (const ch of voiceChannels) {
                const parentInfo = ch.parent ? ` (Kategori: ${escapeMarkdown(ch.parent.name)})` : '';
                await sendVoiceLog(channel.client, channel.guild.id, 'Ses Kanalı Oluşturuldu', `${executorId} tarafından <#${ch.id}> adlı yeni ses kanalı oluşturuldu.${parentInfo}`, executorId, 'global');
            }
        }, 3000);
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

            let executorId = 'Bilinmiyor';
            let reason = 'Belirtilmedi';
            try {
                const fetchedLogs = await data.items[0].guild.fetchAuditLogs({ limit: Math.min(data.items.length, 10), type: AuditLogEvent.ChannelDelete });
                const log = fetchedLogs.entries.first();
                if (log && Date.now() - log.createdTimestamp < 10000) {
                    executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
                    if (log.reason) reason = log.reason;
                }
            } catch (e) {}

            const voiceChannels = data.items.filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice);
            const otherChannels = data.items.filter(ch => ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice);

            if (otherChannels.length > 0) {
                const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const fields = [
                    { name: 'Silen Yetkili', value: executorId },
                    { name: 'Sebep', value: reason },
                    { name: 'Zaman', value: now }
                ];
                otherChannels.slice(0, 50).forEach(ch => {
                    const parentInfo = ch.parentName ? ` | Kategori: \`${ch.parentName}\`` : '';
                    fields.push({ name: 'Silinen Kanal', value: `İsim: \`${escapeMarkdown(ch.name)}\` | Tür: ${channelTypeToTurkish(ch.type)} | ID: \`${ch.id}\`${parentInfo}` });
                });
                const title = otherChannels.length > 1 ? `Toplu ${otherChannels.length} Kanal Silindi` : 'Kanal Silindi';
                logSystemEvent(data.items[0].guild, title, fields, '#2B2D31');
            }

            for (const ch of voiceChannels) {
                const parentInfo = ch.parentName ? ` (Kategori: ${escapeMarkdown(ch.parentName)})` : '';
                await sendVoiceLog(data.items[0].guild.client, data.items[0].guild.id, 'Ses Kanalı Silindi', `${executorId} tarafından **${escapeMarkdown(ch.name)}** adlı ses kanalı silindi.${parentInfo} Sebep: ${escapeMarkdown(reason)}`, executorId, 'global');
            }
        }, 3000);
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

            let executorId = 'Bilinmiyor';
            try {
                const fetchedLogs = await role.guild.fetchAuditLogs({ limit: Math.min(data.items.length, 10), type: AuditLogEvent.RoleCreate });
                const log = fetchedLogs.entries.first();
                if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
            } catch (e) {}

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Oluşturan Yetkili', value: executorId },
                { name: 'Zaman', value: now }
            ];
            data.items.slice(0, 50).forEach(r => {
                const colorHex = r.hexColor !== '#000000' ? ` | Renk: ${r.hexColor}` : '';
                fields.push({ name: 'Yeni Rol', value: `<@&${r.id}> (\`${r.name}\`) | ID: \`${r.id}\`${colorHex}` });
            });
            const title = data.items.length > 1 ? `Toplu ${data.items.length} Rol Oluşturuldu` : 'Yeni Rol Oluşturuldu';
            logSystemEvent(role.guild, title, fields, '#2B2D31');
        }, 3000);
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

            let executorId = 'Bilinmiyor';
            try {
                const fetchedLogs = await role.guild.fetchAuditLogs({ limit: Math.min(data.items.length, 10), type: AuditLogEvent.RoleDelete });
                const log = fetchedLogs.entries.first();
                if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
            } catch (e) {}

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Silen Yetkili', value: executorId },
                { name: 'Zaman', value: now }
            ];
            data.items.slice(0, 50).forEach(r => {
                fields.push({ name: 'Silinen Rol', value: `İsim: \`${r.name}\` | ID: \`${r.id}\`` });
            });
            const title = data.items.length > 1 ? `Toplu ${data.items.length} Rol Silindi` : 'Rol Silindi';
            logSystemEvent(role.guild, title, fields, '#2B2D31');
        }, 3000);
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
        if (!oldChannel.permissionOverwrites.cache.equals(newChannel.permissionOverwrites.cache)) changes.push({ name: 'İzinler', value: 'Kanal yetkilerinde güncelleme yapıldı.' });

        if (changes.length === 0) return;

        let executorId = 'Bilinmiyor';
        try {
            // İzin değişiklikleri ChannelOverwriteUpdate olarak geçer, bu yüzden type kısıtlamasını kaldırıyoruz.
            const fetchedLogs = await newChannel.guild.fetchAuditLogs({ limit: 1 });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === newChannel.id && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
            }
        } catch (e) {}

        const isVoice = newChannel.type === ChannelType.GuildVoice || newChannel.type === ChannelType.GuildStageVoice;
        
        if (isVoice) {
            const changeDesc = changes.map(c => `**${c.name}:** ${c.value}`).join(' | ');
            await sendVoiceLog(newChannel.client, newChannel.guild.id, 'Ses Kanalı Güncellendi', `${executorId} tarafından <#${newChannel.id}> kanalında değişiklik yapıldı: ${changeDesc}`, executorId, `room:${newChannel.id}`);
        } else {
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Kanal', value: `<#${newChannel.id}> (\`${newChannel.name}\`)` },
                { name: 'Tür', value: channelTypeToTurkish(newChannel.type) },
                { name: 'Değiştiren', value: executorId },
                { name: 'Zaman', value: now },
                ...changes
            ];

            logSystemEvent(newChannel.guild, 'Kanal Güncellendi', fields, '#2B2D31');
        }
    }
},
{
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        if (!ban.guild) return;

        let executorId = 'Bilinmiyor';
        let reason = 'Belirtilmedi';
        try {
            const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === ban.user.id && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
                if (log.reason) reason = log.reason;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Yasaklanan Kullanıcı', value: `<@${ban.user.id}> (\`${escapeMarkdown(ban.user.tag)}\`)` },
            { name: 'Kullanıcı ID', value: `\`${ban.user.id}\`` },
            { name: 'Yasaklayan Yetkili', value: executorId },
            { name: 'Sebep', value: escapeMarkdown(reason) },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(ban.guild, 'Kullanıcı Yasaklandı (Ban)', fields, '#2B2D31');
    }
},
{
    name: Events.GuildBanRemove,
    async execute(ban, client) {
        if (!ban.guild) return;

        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === ban.user.id && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kullanıcı', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)` },
            { name: 'Kullanıcı ID', value: `\`${ban.user.id}\`` },
            { name: 'Yasağı Kaldıran', value: executorId },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(ban.guild, 'Yasaklama (Ban) Kaldırıldı', fields, '#2B2D31');
    }
},
{
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        if (!member.guild || member.user.bot) return;

        let action = 'Sunucudan Ayrıldı';
        let executorId = null;
        let reason = null;

        try {
            const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === member.id && Date.now() - log.createdTimestamp < 10000) {
                action = 'Sunucudan Atıldı (Kick)';
                executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
                reason = log.reason || 'Belirtilmedi';
            }
        } catch (e) {}

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

        if (executorId) {
            fields.splice(2, 0, { name: 'Atan Yetkili', value: executorId });
            fields.splice(3, 0, { name: 'Sebep', value: escapeMarkdown(reason) });
        }

        const color = '#2B2D31';
        logSystemEvent(member.guild, action, fields, color);
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

        logSystemEvent(invite.guild, 'Yeni Davet Bağlantısı Oluşturuldu', fields, '#2B2D31');
    }
},
{
    name: Events.InviteDelete,
    async execute(invite, context) {
        if (!invite.guild) return;

        let executorId = 'Bilinmiyor';
        try {
            const guild = invite.guild;
            const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.InviteDelete });
            const log = fetchedLogs.entries.first();
            if (log && log.target?.code === invite.code && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: invite.channel ? `<#${invite.channel.id}>` : 'Bilinmiyor' },
            { name: 'Davet Kodu', value: `\`${invite.code}\`` },
            { name: 'Silen', value: executorId },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(invite.guild, 'Davet Bağlantısı Silindi', fields, '#2B2D31');
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
        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            const added = newRole.permissions.toArray().filter(p => !oldRole.permissions.has(p));
            const removed = oldRole.permissions.toArray().filter(p => !newRole.permissions.has(p));
            if (added.length > 0) changes.push({ name: 'Eklenen İzinler', value: added.join(', ') });
            if (removed.length > 0) changes.push({ name: 'Kaldırılan İzinler', value: removed.join(', ') });
        }

        if (changes.length === 0) return;

        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === newRole.id && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}> (\`${log.executor.tag}\`)`;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Rol', value: `<@&${newRole.id}> (\`${newRole.name}\`)` },
            { name: 'Değiştiren', value: executorId },
            { name: 'Zaman', value: now },
            ...changes
        ];

        logSystemEvent(newRole.guild, 'Rol Güncellendi', fields, '#2B2D31');
    }
},
{
    name: Events.RoleCreate,
    async execute(role) {
        if (!role.guild) return;
        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === role.id && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${escapeMarkdown(log.executor.tag)}\`)`;
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Oluşturan Yetkili', value: executorId },
            { name: 'Rol', value: `<@&${role.id}> (\`${escapeMarkdown(role.name)}\`)` },
            { name: 'Zaman', value: now }
        ];
        logSystemEvent(role.guild, 'Yeni Rol Oluşturuldu', fields, '#2B2D31');
    }
},
{
    name: Events.RoleDelete,
    async execute(role) {
        if (!role.guild) return;
        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
            const log = fetchedLogs.entries.first();
            if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${escapeMarkdown(log.executor.tag)}\`)`;
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Silen Yetkili', value: executorId },
            { name: 'Silinen Rol', value: `\`${escapeMarkdown(role.name)}\` (ID: \`${role.id}\`)` },
            { name: 'Zaman', value: now }
        ];
        logSystemEvent(role.guild, 'Rol Silindi', fields, '#2B2D31');
    }
},
{
    name: Events.WebhooksUpdate,
    async execute(channel) {
        if (!channel.guild) return;
        let executorId = 'Bilinmiyor';
        let action = 'Güncellendi';
        try {
            const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1 });
            const log = fetchedLogs.entries.first();
            if (log && (log.action === AuditLogEvent.WebhookCreate || log.action === AuditLogEvent.WebhookUpdate || log.action === AuditLogEvent.WebhookDelete) && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}> (\`${escapeMarkdown(log.executor.tag)}\`)`;
                if (log.action === AuditLogEvent.WebhookCreate) action = 'Oluşturuldu';
                else if (log.action === AuditLogEvent.WebhookDelete) action = 'Silindi';
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: `<#${channel.id}> (\`${escapeMarkdown(channel.name)}\`)` },
            { name: 'İşlem Yapan', value: executorId },
            { name: 'Aksiyon', value: action },
            { name: 'Zaman', value: now }
        ];
        logSystemEvent(channel.guild, 'Webhook Güncellemesi', fields, '#2B2D31');
    }
},
{
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
            const log = fetchedLogs.entries.first();
            if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${escapeMarkdown(log.executor.tag)}\`)`;
        } catch (e) {}

        const changes = [];
        if (oldGuild.name !== newGuild.name) changes.push({ name: 'Sunucu Adı', value: `\`${escapeMarkdown(oldGuild.name)}\` → \`${escapeMarkdown(newGuild.name)}\`` });
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push({ name: 'Özel URL', value: `\`${oldGuild.vanityURLCode || 'Yok'}\` → \`${newGuild.vanityURLCode || 'Yok'}\`` });
        
        if (changes.length === 0) return;
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Değiştiren Yetkili', value: executorId },
            { name: 'Zaman', value: now },
            ...changes
        ];
        logSystemEvent(newGuild, 'Sunucu Ayarları Güncellendi', fields, '#2B2D31');
    }
},
{
    name: Events.EmojiCreate,
    async execute(emoji) {
        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiCreate });
            const log = fetchedLogs.entries.first();
            if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${escapeMarkdown(log.executor.tag)}\`)`;
        } catch (e) {}
        
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logSystemEvent(emoji.guild, 'Emoji Eklendi', [
            { name: 'Ekleyen', value: executorId },
            { name: 'Emoji', value: `${emoji} (\`${emoji.name}\`)` },
            { name: 'Zaman', value: now }
        ], '#2B2D31');
    }
},
{
    name: Events.EmojiDelete,
    async execute(emoji) {
        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete });
            const log = fetchedLogs.entries.first();
            if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}> (\`${escapeMarkdown(log.executor.tag)}\`)`;
        } catch (e) {}
        
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logSystemEvent(emoji.guild, 'Emoji Silindi', [
            { name: 'Silen', value: executorId },
            { name: 'Emoji Adı', value: `\`${emoji.name}\`` },
            { name: 'Zaman', value: now }
        ], '#2B2D31');
    }
}];