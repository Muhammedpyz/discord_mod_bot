const { Events, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { buildModBResponse } = require('../utils/uiBuilder');

const memberAddDebounce = new Map();
const memberRemoveDebounce = new Map();

function logSystemEvent(guild, title, fields, colorHex = '#2B2D31', logType = 'system') {
    const payload = buildModBResponse({ title, fields, color: colorHex });
    sendLog(guild, payload, logType);
}

module.exports = [
{
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        if (!ban.guild) return;

        let executorId = 'Bilinmiyor';
        let reason = 'Sebep belirtilmedi';
        try {
            const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === ban.user.id && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}>`;
                if (log.reason) reason = log.reason;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Yasaklanan', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)` },
            { name: 'ID', value: `\`${ban.user.id}\`` },
            { name: 'Yetkili', value: executorId },
            { name: 'Sebep', value: reason },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(ban.guild, 'Uye Yasaklandi (Ban)', fields, '#2B2D31');
    }
},
{
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        if (!member.guild) return;
        const guildId = member.guild.id;
        if (!memberAddDebounce.has(guildId)) memberAddDebounce.set(guildId, { items: [], timeout: null });
        const data = memberAddDebounce.get(guildId);
        data.items.push(member);
        if (data.timeout) clearTimeout(data.timeout);
        data.timeout = setTimeout(async () => {
            memberAddDebounce.delete(guildId);
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [{ name: 'Zaman', value: now }];

            if (data.items.length === 1) {
                const m = data.items[0];
                const accountAgeDays = Math.round((Date.now() - m.user.createdTimestamp) / (1000 * 60 * 60 * 24));
                fields.push({ name: 'Uye', value: `<@${m.id}> (\`${m.user.tag}\`)` });
                fields.push({ name: 'ID', value: `\`${m.id}\`` });
                fields.push({ name: 'Hesap Yasi', value: `${accountAgeDays} gun` });
                fields.push({ name: 'Toplam Uye', value: `${m.guild.memberCount}` });
            } else {
                data.items.slice(0, 50).forEach(m => {
                    fields.push({ name: 'Katilan Uye', value: `<@${m.id}> (\`${m.user.tag}\`)` });
                });
                fields.push({ name: 'Toplam Katilim', value: `${data.items.length} uye` });
            }
            const title = data.items.length > 1 ? `Toplu ${data.items.length} Uye Katildi` : 'Yeni Uye Katildi';
            logSystemEvent(member.guild, title, fields, '#2B2D31');
        }, 3000);
    }
},
{
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        if (!member.guild) return;
        const guildId = member.guild.id;
        if (!memberRemoveDebounce.has(guildId)) memberRemoveDebounce.set(guildId, { items: [], timeout: null });
        const data = memberRemoveDebounce.get(guildId);
        data.items.push(member);
        if (data.timeout) clearTimeout(data.timeout);
        data.timeout = setTimeout(async () => {
            memberRemoveDebounce.delete(guildId);

            let executorId = 'Bilinmiyor';
            let reason = 'Kendi ayrildi';
            try {
                const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
                const log = fetchedLogs.entries.first();
                if (log && log.target.id === data.items[data.items.length - 1].id && Date.now() - log.createdTimestamp < 10000) {
                    executorId = `<@${log.executor.id}>`;
                    if (log.reason) reason = log.reason;
                }
            } catch (e) {}

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Yetkili', value: executorId },
                { name: 'Sebep', value: reason },
                { name: 'Zaman', value: now }
            ];

            if (data.items.length === 1) {
                const m = data.items[0];
                fields.unshift({ name: 'Ayrilan Uye', value: `<@${m.id}> (\`${m.user.tag}\`)` });
                fields.push({ name: 'Kalan Uye', value: `${m.guild.memberCount}` });
            } else {
                data.items.slice(0, 50).forEach(m => {
                    fields.push({ name: 'Ayrilan Uye', value: `<@${m.id}> (\`${m.user.tag}\`)` });
                });
                fields.push({ name: 'Toplam Ayrilis', value: `${data.items.length} uye` });
            }
            const title = data.items.length > 1 ? `Toplu ${data.items.length} Uye Ayrildi` : 'Uye Ayrildi';
            logSystemEvent(member.guild, title, fields, '#2B2D31');
        }, 3000);
    }
},
{
    name: Events.GuildEmojiUpdate,
    async execute(emoji, client) {
        if (!emoji.guild) return;
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let actionDesc = 'Bilinmiyor';
        try {
            const fetchedLogs = await emoji.guild.fetchAuditLogs({ limit: 1, type: 'EmojiCreate' in AuditLogEvent ? AuditLogEvent.EmojiCreate : AuditLogEvent.GuildUpdate });
            const log = fetchedLogs.entries.first();
            if (log && Date.now() - log.createdTimestamp < 10000) {
                if (log.action === AuditLogEvent.EmojiCreate || log.action === 'EmojiCreate') actionDesc = `Eklendi (Yetkili: <@${log.executor.id}>)`;
                else if (log.action === AuditLogEvent.EmojiDelete || log.action === 'EmojiDelete') actionDesc = `Silindi (Yetkili: <@${log.executor.id}>)`;
                else actionDesc = 'Guncellendi';
            }
        } catch (e) {}

        const fields = [
            { name: 'Emoji', value: `${emoji.name} (\`${emoji.id}\`)` },
            { name: 'Islem', value: actionDesc },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(emoji.guild, 'Emoji Guncellendi', fields, '#2B2D31');
    }
},
{
    name: Events.WebhooksUpdate,
    async execute(channel, client) {
        if (!channel || !channel.guild) return;
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
            const log = fetchedLogs.entries.first();
            if (log && Date.now() - log.createdTimestamp < 10000) executorId = `<@${log.executor.id}>`;
        } catch (e) {}

        const fields = [
            { name: 'Kanal', value: `<#${channel.id}> (\`${channel.name}\`)` },
            { name: 'Yetkili', value: executorId },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(channel.guild, 'Webhook Guncellendi', fields, '#2B2D31');
    }
},
{
    name: Events.GuildBanRemove,
    async execute(ban, client) {
        if (!ban.guild) return;

        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BanRemove });
            const log = fetchedLogs.entries.first();
            if (log && log.target.id === ban.user.id && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}>`;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kullanici', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)` },
            { name: 'ID', value: `\`${ban.user.id}\`` },
            { name: 'Yetkili', value: executorId },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(ban.guild, 'Yasaklama (Ban) Kaldirildi', fields, '#2B2D31');
    }
},
{
    name: Events.InviteCreate,
    async execute(invite) {
        if (!invite.guild) return;

        const inviter = invite.inviter ? `<@${invite.inviter.id}>` : 'Bilinmiyor';
        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await invite.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.InviteCreate });
            const log = fetchedLogs.entries.first();
            if (log && log.target?.code === invite.code && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}>`;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: invite.channel ? `<#${invite.channel.id}>` : 'Bilinmiyor' },
            { name: 'Olusturan', value: inviter },
            { name: 'Kod', value: `\`${invite.code}\`` },
            { name: 'Sure/Kullanim', value: `${invite.maxAge ? `${invite.maxAge}sn` : 'Suresiz'} / ${invite.maxUses ? `${invite.maxUses} kullanim` : 'Sinirsiz'}` },
            { name: 'Yetkili', value: executorId },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(invite.guild, 'Yeni Davet Baglantisi Olusturuldu', fields, '#2B2D31');
    }
},
{
    name: Events.InviteDelete,
    async execute(invite) {
        if (!invite.guild) return;

        let executorId = 'Bilinmiyor';
        try {
            const fetchedLogs = await invite.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.InviteDelete });
            const log = fetchedLogs.entries.first();
            if (log && log.target?.code === invite.code && Date.now() - log.createdTimestamp < 10000) {
                executorId = `<@${log.executor.id}>`;
            }
        } catch (e) {}

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fields = [
            { name: 'Kanal', value: invite.channel ? `<#${invite.channel.id}>` : 'Bilinmiyor' },
            { name: 'Kod', value: `\`${invite.code}\`` },
            { name: 'Yetkili', value: executorId },
            { name: 'Zaman', value: now }
        ];

        logSystemEvent(invite.guild, 'Davet Baglantisi Silindi', fields, '#2B2D31');
    }
},
{
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!oldChannel.guild) return;
        if (oldChannel.name !== newChannel.name) {
            let executorId = 'Bilinmiyor';
            try {
                const fetchedLogs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
                const log = fetchedLogs.entries.first();
                if (log && log.target.id === newChannel.id && Date.now() - log.createdTimestamp < 10000) {
                    executorId = `<@${log.executor.id}>`;
                }
            } catch (e) {}

            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const fields = [
                { name: 'Kanal', value: `<#${newChannel.id}>` },
                { name: 'Eski Isim', value: `\`${oldChannel.name}\`` },
                { name: 'Yeni Isim', value: `\`${newChannel.name}\`` },
                { name: 'Yetkili', value: executorId },
                { name: 'Zaman', value: now }
            ];

            logSystemEvent(newChannel.guild, 'Kanal Isin Degisikligi', fields, '#2B2D31');
        }
    }
}
];