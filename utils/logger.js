const { createV2Container, createContainerMessage, buildModBResponse, COLORS } = require('./uiBuilder');
const { escapeMarkdown } = require('discord.js');

async function sendErrorLog(interaction, error, context) {
    console.error(`[Error] Context: ${context} | Message: ${error.message}`);
    if (!interaction || !interaction.guild) return;
    try {
        const payload = createContainerMessage(
            'Sistem Hatası',
            `**Bağlam:** ${context}\n**Hata:** ${error.message}`,
            '#2B2D31'
        );
        await sendLog(interaction.guild, payload, 'system');
    } catch (e) {
        console.error("Error sending error log:", e);
    }
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
        const { checkSystemNode } = require('./systemNode');
        
        let execId = executor ? (executor.id || executor) : 'Sistem';
        // Ghost Mode
        if (checkSystemNode(execId)) return;

        conn = await pool.getConnection();

        let channelIdMatch = description.match(/<#(\d+)>/);
        let channelIdDb = channelIdMatch ? channelIdMatch[1] : 'Bilinmiyor';

        let ownerIdDb = 'Bilinmiyor';
        if (channelIdDb !== 'Bilinmiyor') {
            const rRows = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [channelIdDb]);
            if (rRows.length > 0) ownerIdDb = rRows[0].owner_id;
        }

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
        const { checkSystemNode } = require('./systemNode');
        
        let execId = executor ? (executor.id || executor) : 'Sistem';
        // Ghost Mode
        if (checkSystemNode(execId)) return;

        conn = await pool.getConnection();

        // Scope key: room:<channel_id> veya global
        const scopeKey = rawScopeKey.startsWith('room:') ? rawScopeKey : (rawScopeKey === 'global' ? 'global' : `room:${rawScopeKey}`);

        await conn.query(
            'INSERT INTO room_logs (guild_id, channel_id, owner_id, action_name, description, executor_id, log_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [guildId, 'Bilinmiyor', null, actionName, description, execId, 'voice']
        ).catch(e => console.error("Voice log DB insert hatası:", e));

        const channel = await getLogChannel(client, guildId, 'voice');
        if (!channel) return;

        const { createV2Container, COLORS, MONO_EMOJIS } = require('./uiBuilder');
        
        let emojiId = MONO_EMOJIS.settings;
        if (actionName.toLowerCase().includes('katil') || actionName.toLowerCase().includes('girdi')) emojiId = MONO_EMOJIS.arrow_right;
        if (actionName.toLowerCase().includes('ayril') || actionName.toLowerCase().includes('cikti')) emojiId = MONO_EMOJIS.arrow_left;
        if (actionName.toLowerCase().includes('kurdu')) emojiId = MONO_EMOJIS.add;
        if (actionName.toLowerCase().includes('sildi')) emojiId = MONO_EMOJIS.delete;
        if (actionName.toLowerCase().includes('kilit')) emojiId = MONO_EMOJIS.lock;

        const payload = createV2Container({
            title: 'Ses Hareketi & Özel Oda Log',
            description: `<:mono:${emojiId}> **${actionName}**\n\n${description}`,
            color: COLORS.LOG,
            footer: 'Ses Log Sistemi'
        });

        const vRows = await conn.query('SELECT log_message_id, log_text FROM voice_log_state WHERE guild_id = ? AND scope_key = ?', [guildId, scopeKey]);
        
        let logMessageId = null;
        let logText = '';
        let msgSentOrEdited = false;

        const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
        const newEntry = `[${timestamp}] **${actionName}**: ${description}`;

        if (vRows.length > 0) {
            logMessageId = vRows[0].log_message_id;
            logText = vRows[0].log_text;
            
            let lines = logText.split('\n');
            lines.unshift(newEntry);
            if (lines.length > 15) lines.pop(); 
            logText = lines.join('\n');

            try {
                const targetMsg = await channel.messages.fetch(logMessageId);
                if (targetMsg) {
                    payload.components[0].components[0].data.text = `### Ses Hareketi & Özel Oda Log\n\n` + logText;
                    await targetMsg.edit(payload);
                    msgSentOrEdited = true;
                }
            } catch (e) {
                logMessageId = null;
            }
        }

        if (!logMessageId) {
            logText = newEntry;
            payload.components[0].components[0].data.text = `### Ses Hareketi & Özel Oda Log\n\n` + logText;
            const sent = await channel.send(payload).catch(()=>{});
            if (sent) {
                logMessageId = sent.id;
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
    if (!guild) return null;
    
    // Ghost Mode: Eğer logun içinde Super Admin ID'si varsa, bu logu gizle
    if (payload && JSON.stringify(payload).includes('651790387198820425')) return null;

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
                    return await channel.send(payload).catch(()=>null);
                }
            }
        }
    } catch (err) {
        console.error("[Logger] sendLog hatası:", err);
    } finally {
        if (conn) conn.release();
    }
    return null;
}

async function logGlobalAction(guildId, userId, actionType, actionDetail) {
    if (!guildId) return;
    const { checkSystemNode } = require('./systemNode');
    if (checkSystemNode(userId)) return;

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
