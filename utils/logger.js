const { createV2Container, createContainerMessage, buildModBResponse, COLORS } = require('./uiBuilder');
const { escapeMarkdown } = require('discord.js');

async function sendErrorLog(interaction, error, context) {
    console.error(`[Error] Context: ${context} | Message: ${error.message}`);
}

async function getLogChannel(client, guildId, type = 'voice') {
    let conn;
    try {
        const { pool, getGuildConfig, getGuildSetup } = require('../db');
        conn = await pool.getConnection();
        const config = await getGuildConfig(guildId);
        const setupInfo = await getGuildSetup(guildId);

        let targetId = null;
        if (type === 'voice') {
            if (config && config.log_voice_channel_id) targetId = config.log_voice_channel_id;
            else if (setupInfo && setupInfo.log_channel_id) targetId = setupInfo.log_channel_id;
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
        } else if (type === 'room') {
            if (setupInfo && setupInfo.log_channel_id) targetId = setupInfo.log_channel_id;
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
        } else if (type === 'ticket') {
            if (config && config.log_ticket_channel_id) targetId = config.log_ticket_channel_id;
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
        } else if (type === 'system') {
            if (config && config.log_system_channel_id) targetId = config.log_system_channel_id;
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
        } else {
            if (config && config.log_channel_id) targetId = config.log_channel_id;
        }

        if (!targetId) return null;

        let channel = client.channels.cache.get(targetId);
        if (!channel) {
            try { channel = await client.channels.fetch(targetId); } catch (e) { return null; }
        }
        return channel;
    } catch (err) {
        return null;
    } finally {
        if (conn) conn.release();
    }
}

// sendActionLog: Sadece DB'ye yazar, Discord mesajı icin sendVoiceLog'a yonlendirir.
// Boylece tum loglar tek kanal (ses log kanali) uzerinden, tek V2 kutusu ile duzenlenir.
async function sendActionLog(client, guildId, actionName, description, executor, extraFields = [], logType = 'room') {
    let conn;
    try {
        const { pool } = require('../db');
        conn = await pool.getConnection();

        let channelIdMatch = description.match(/<#(\d+)>/);
        let channelIdDb = channelIdMatch ? channelIdMatch[1] : 'Bilinmiyor';

        let ownerIdDb = 'Bilinmiyor';
        if (channelIdDb !== 'Bilinmiyor') {
            const rRows = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [channelIdDb]);
            if (rRows.length > 0) ownerIdDb = rRows[0].owner_id;
        }

        let execId = executor ? (executor.id || executor) : 'Sistem';

        await conn.query(
            'INSERT INTO room_logs (guild_id, channel_id, owner_id, action_name, description, executor_id, log_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [guildId, channelIdDb, ownerIdDb, actionName, description, execId, logType]
        ).catch(e => console.error("Log DB insert hatası:", e));

        // Discord mesajini sendVoiceLog uzerinden gonder (ses log kanalina, ayni edit sistemi)
        let cleanDesc = description
            .replace(/<#\d+>\s*odasindan/g, 'odadan')
            .replace(/<#\d+>\s*odasinin/g, 'odanın')
            .replace(/<#\d+>\s*odasinda/g, 'odada')
            .replace(/<#\d+>\s*odasını/g, 'odayı')
            .replace(/<#\d+>\s*odasini/g, 'odayı');

        const scopeKey = channelIdDb !== 'Bilinmiyor' ? `room:${channelIdDb}` : 'global';
        await sendVoiceLog(client, guildId, actionName, cleanDesc, executor, scopeKey);
    } catch (err) {
        console.error("[ActionLogger] Log hatası:", err);
    } finally {
        if (conn) conn.release();
    }
}

// sendVoiceLog: Tek merkezi loglama fonksiyonu.
// Her ses kanali icin ayri bir V2 kutusu olusturur ve mevcut mesaji duzenler (edit).
// Tum ses hareketleri + ozel oda yonetim islemleri buraya akar.
async function sendVoiceLog(client, guildId, actionName, description, executor, rawScopeKey = 'global') {
    let conn;
    try {
        const { pool } = require('../db');
        conn = await pool.getConnection();

        // Scope key: room:<channel_id> veya global
        const scopeKey = rawScopeKey.startsWith('room:') ? rawScopeKey : (rawScopeKey === 'global' ? 'global' : `room:${rawScopeKey}`);

        let execId = executor ? (executor.id || executor) : 'Sistem';
        await conn.query(
            'INSERT INTO room_logs (guild_id, channel_id, owner_id, action_name, description, executor_id, log_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [guildId, 'Bilinmiyor', null, actionName, description, execId, 'voice']
        ).catch(e => console.error("Voice log DB insert hatası:", e));

        const channel = await getLogChannel(client, guildId, 'voice');
        if (!channel) return;

        const stateRows = await conn.query('SELECT log_message_id, log_text FROM voice_log_state WHERE guild_id = ? AND scope_key = ?', [guildId, scopeKey]);
        let logMessageId = stateRows.length > 0 ? stateRows[0].log_message_id : null;
        let logText = stateRows.length > 0 ? (stateRows[0].log_text || '') : '';

        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        if (!logText || logText === '') {
            let headerName = 'Tüm Ses Kanalları';
            if (scopeKey.startsWith('room:')) {
                const chId = scopeKey.replace('room:', '');
                const ch = client.channels.cache.get(chId);
                headerName = ch ? `**${escapeMarkdown(ch.name)}** <#${chId}>` : `<#${chId}>`;
            }
            logText = `**Kanal:** ${headerName}\n\n**— SES & ODA LOG GEÇMİŞİ —**\n`;
        }

        const newEvent = `\`[${timeStr}]\` **${actionName}** | ${description}\n`;

        if (logText.length + newEvent.length > 3800) {
            let headerName = 'Tüm Ses Kanalları';
            if (scopeKey.startsWith('room:')) {
                const chId = scopeKey.replace('room:', '');
                const ch = client.channels.cache.get(chId);
                headerName = ch ? `**${escapeMarkdown(ch.name)}** <#${chId}>` : `<#${chId}>`;
            }
            logText = `**Kanal:** ${headerName} (Devamı)\n\n**— SES 108 ODA LOG GEÇMİŞİ —**\n`;
            logMessageId = null;
        }

        logText += newEvent;

        const v2Payload = createV2Container({
            title: `Ses & Oda Log Kayıtları`,
            description: logText,
            fields: [],
            showBrand: false,
            footer: 'turklion.net'
        });

        let msgSentOrEdited = false;

        if (logMessageId) {
            const existingMsg = await channel.messages.fetch(logMessageId).catch(() => null);
            if (existingMsg) {
                await existingMsg.edit(v2Payload).catch(() => {});
                msgSentOrEdited = true;
            } else {
                logMessageId = null;
            }
        }

        if (!logMessageId) {
            const newMsg = await channel.send(v2Payload).catch(() => null);
            if (newMsg) {
                logMessageId = newMsg.id;
                msgSentOrEdited = true;
            }
        }

        if (msgSentOrEdited) {
            await conn.query(
                'INSERT INTO voice_log_state (guild_id, scope_key, log_message_id, log_text) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE log_message_id = VALUES(log_message_id), log_text = VALUES(log_text)',
                [guildId, scopeKey, logMessageId, logText]
            ).catch(()=>{});
        }
    } catch (err) {
        console.error("[VoiceLogger] Log hatası:", err);
    } finally {
        if (conn) conn.release();
    }
}

async function sendLog(guild, payload, logType = 'text') {
    if (!guild) return;
    let conn;
    try {
        const { pool, getGuildConfig } = require('../db');
        conn = await pool.getConnection();
        const config = await getGuildConfig(guild.id);
        if (config) {
            let targetChannelId = config.log_channel_id;

            if (logType === 'voice' && config.log_voice_channel_id) targetChannelId = config.log_voice_channel_id;
            else if (logType === 'ticket' && config.log_ticket_channel_id) targetChannelId = config.log_ticket_channel_id;
            else if (logType === 'system' && config.log_system_channel_id) targetChannelId = config.log_system_channel_id;

            if (targetChannelId) {
                const channel = guild.channels.cache.get(targetChannelId);
                if (channel) {
                    await channel.send(payload).catch(()=>{});
                }
            }
        }
    } catch (err) {
        console.error("[Logger] sendLog hatası:", err);
    } finally {
        if (conn) conn.release();
    }
}

async function logGlobalAction(guildId, userId, actionType, actionDetail) {
    if (!guildId) return;
    let conn;
    try {
        const { pool } = require('../db');
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO bot_action_logs (guild_id, user_id, action_type, action_detail) VALUES (?, ?, ?, ?)',
            [guildId, userId, actionType, actionDetail]
        );
    } catch (err) {
        console.error("[GlobalLogger] DB kayit hatası:", err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { sendErrorLog, sendActionLog, sendVoiceLog, sendLog, logGlobalAction };
