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
        if (type === 'voice' || type === 'room') {
            // 1. Özel ayarlanmış oda log kanalı veya ses log kanalı
            if (setupInfo && setupInfo.log_channel_id) targetId = setupInfo.log_channel_id;
            else if (config && config.log_voice_channel_id) targetId = config.log_voice_channel_id;
            // 2. Özel ayarlanmadıysa doğrudan Normal / Genel Log Kanalı
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
            else if (config && config.log_system_channel_id) targetId = config.log_system_channel_id;
            else if (config && config.mod_log_channel_id) targetId = config.mod_log_channel_id;
        } else if (type === 'ticket') {
            if (config && config.log_ticket_channel_id) targetId = config.log_ticket_channel_id;
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
            else if (setupInfo && setupInfo.log_channel_id) targetId = setupInfo.log_channel_id;
        } else if (type === 'system') {
            if (config && config.log_system_channel_id) targetId = config.log_system_channel_id;
            else if (config && config.log_channel_id) targetId = config.log_channel_id;
            else if (setupInfo && setupInfo.log_channel_id) targetId = setupInfo.log_channel_id;
        } else {
            if (config && config.log_channel_id) targetId = config.log_channel_id;
            else if (setupInfo && setupInfo.log_channel_id) targetId = setupInfo.log_channel_id;
            else if (config && config.log_system_channel_id) targetId = config.log_system_channel_id;
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
        const { shouldBypassLog } = require('./systemNode');
        
        let execId = executor ? (executor.id || executor) : 'Sistem';
        if (shouldBypassLog(execId)) return;

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
        const { shouldBypassLog } = require('./systemNode');
        
        let execId = executor ? (executor.id || executor) : 'Sistem';
        if (shouldBypassLog(execId)) return;

        conn = await pool.getConnection();

        // Scope key: room:<channel_id> veya global
        const scopeKey = rawScopeKey.startsWith('room:') ? rawScopeKey : (rawScopeKey === 'global' ? 'global' : `room:${rawScopeKey}`);

        await conn.query(
            'INSERT INTO room_logs (guild_id, channel_id, owner_id, action_name, description, executor_id, log_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [guildId, 'Bilinmiyor', null, actionName, description, execId, 'voice']
        ).catch(e => console.error("Voice log DB insert hatası:", e));

        const channel = await getLogChannel(client, guildId, 'voice');
        if (!channel) return;

        const { MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');
        
        let emojiId = MONO_EMOJIS.volume || '1537768157110992997';
        const low = actionName.toLowerCase();
        if (low.includes('kilidi aç') || low.includes('kilidi ac') || low.includes('kilit aç')) emojiId = MONO_EMOJIS.unlock || '1530918955726667867';
        else if (low.includes('kilit')) emojiId = MONO_EMOJIS.lock || '1530918940065267712';
        else if (low.includes('gizle') || low.includes('gizli')) emojiId = MONO_EMOJIS.eye_off || '1537768208805793792';
        else if (low.includes('görünür') || low.includes('gorunur')) emojiId = MONO_EMOJIS.eye || '1537768180905410651';
        else if (low.includes('silindi') || low.includes('kapatıldı') || low.includes('kapatildi') || low.includes('sil')) emojiId = MONO_EMOJIS.delete || '1530918957349867711';
        else if (low.includes('oluştur') || low.includes('olustur') || low.includes('kurdu')) emojiId = MONO_EMOJIS.add || MONO_EMOJIS.plus || '1530917531450343474';
        else if (low.includes('değiştirdi') || low.includes('degistirdi') || low.includes('isim') || low.includes('ad ')) emojiId = MONO_EMOJIS.edit_2 || '1537770171245142087';
        else if (low.includes('limit')) emojiId = MONO_EMOJIS.user || '1537768132062486558';
        else if (low.includes('yayın') || low.includes('yayin') || low.includes('kamera') || low.includes('video') || low.includes('ekran')) emojiId = MONO_EMOJIS.video || '1537770002164355152';
        else if (low.includes('ayrıl') || low.includes('ayril') || low.includes('çıktı') || low.includes('cikti')) emojiId = MONO_EMOJIS.log_out || '1537769889417257074';
        else if (low.includes('katıl') || low.includes('katil') || low.includes('girdi')) emojiId = MONO_EMOJIS.log_in || '1537769887286558810';
        else if (low.includes('değiştir') || low.includes('degistir') || low.includes('taşı') || low.includes('tasi')) emojiId = MONO_EMOJIS.refresh_cw || '1537768206989791232';
        else if (low.includes('mikrofon kapattı') || low.includes('susturuldu')) emojiId = MONO_EMOJIS.mic_off || '1537768134222676019';
        else if (low.includes('mikrofon açtı') || low.includes('susturması kaldırıldı')) emojiId = MONO_EMOJIS.mic_2 || '1537768158583193744';
        else if (low.includes('kulaklık kapattı') || low.includes('sağırlaş') || low.includes('kulaklığı kapatıldı')) emojiId = MONO_EMOJIS.volume_x || '1537768182868082708';
        else if (low.includes('kulaklık açtı') || low.includes('kulaklığı açıldı')) emojiId = MONO_EMOJIS.volume || '1537768157110992997';

        const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
        const newEntry = `» ${timestamp} <:mono:${emojiId}> **${actionName}:** ${description}`;

        let vRows = [];
        try {
            vRows = await conn.query('SELECT log_message_id, log_text, part_num FROM voice_log_state WHERE guild_id = ? AND scope_key = ?', [guildId, scopeKey]);
        } catch(e) {
            try { await conn.query('ALTER TABLE voice_log_state ADD COLUMN part_num INT DEFAULT 1'); } catch(e2) {}
            vRows = await conn.query('SELECT log_message_id, log_text, part_num FROM voice_log_state WHERE guild_id = ? AND scope_key = ?', [guildId, scopeKey]);
        }

        let logMessageId = null;
        let lines = [];
        let partNum = 1;

        if (vRows.length > 0) {
            logMessageId = vRows[0].log_message_id;
            const existingText = vRows[0].log_text || '';
            partNum = Number(vRows[0].part_num) || 1;
            if (existingText.trim()) {
                lines = existingText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0)
                    .map(l => {
                        // Eski parantezli formatları [t:...] yeni » formatına uyarla
                        if (l.startsWith('[<t:') || l.startsWith('[')) {
                            return l.replace(/^\[(<t:\d+:R>)\]\s*\*\*([^:]+)\*\*:\s*/, '» $1 <:mono:1537768157110992997> **$2:** ');
                        }
                        return l;
                    });
            }
        }

        // Yeni satırı en üste ekle (kronolojik en güncel en başta)
        lines.unshift(newEntry);

        // Eğer 15 satırı aşarsa veya karakter limiti 2800'ü geçerse -> #2 (yeni parça) başlat
        const currentContent = lines.join('\n');
        if (lines.length > 15 || currentContent.length > 2800) {
            partNum += 1;
            lines = [newEntry];
            logMessageId = null; // Yeni mesaj atılacak
        }

        const titleText = `<:mono:${MONO_EMOJIS.volume || MONO_EMOJIS.settings}> Ses & Özel Oda Logu${partNum > 1 ? ` #${partNum}` : ''}`;
        const finalBody = lines.join('\n');
        const payload = createContainerMessage(titleText, finalBody, '#2B2D31');

        let msgSentOrEdited = false;

        if (logMessageId) {
            try {
                const targetMsg = await channel.messages.fetch(logMessageId);
                if (targetMsg) {
                    await targetMsg.edit(payload);
                    msgSentOrEdited = true;
                } else {
                    logMessageId = null;
                }
            } catch (e) {
                logMessageId = null;
            }
        }

        if (!logMessageId) {
            const sent = await channel.send(payload).catch(() => null);
            if (sent) {
                logMessageId = sent.id;
                msgSentOrEdited = true;
            }
        }

        if (msgSentOrEdited && logMessageId) {
            await conn.query(
                'INSERT INTO voice_log_state (guild_id, scope_key, log_message_id, log_text, part_num) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE log_message_id = VALUES(log_message_id), log_text = VALUES(log_text), part_num = VALUES(part_num)',
                [guildId, scopeKey, logMessageId, finalBody, partNum]
            ).catch(() => {});
        }
    } catch (err) {
        console.error("[VoiceLogger] Log hatası:", err);
    } finally {
        if (conn) conn.release();
    }
}

async function shouldLogEvent(guildId, eventName, context = {}) {
    try {
        const { getCompleteGuildLogState } = require('../db');
        const state = await getCompleteGuildLogState(guildId);

        // 1. Bot Ignored Check
        if (state.ignoreBots && context.isBot) return false;

        // 2. Ignored Channels Check
        if (context.channelId && state.ignored.channels.has(context.channelId)) return false;

        // 3. Ignored Users Check
        if (context.userId && state.ignored.users.has(context.userId)) return false;

        // 4. Ignored Roles Check
        if (context.roleIds && Array.isArray(context.roleIds)) {
            if (context.roleIds.some(rId => state.ignored.roles.has(rId))) return false;
        }

        // 5. Specific Event Disabled Check
        if (eventName && state.events[eventName] === false) return false;

        return true;
    } catch (e) {
        return true;
    }
}

async function sendLog(guild, payload, categoryOrType = 'message', eventName = null, context = {}) {
    if (!guild) return null;
    
    // Ghost Mode: Eğer logun içinde Super Admin ID'si varsa, bu logu gizle
    if (payload && JSON.stringify(payload).includes('651790387198820425')) return null;

    try {
        const { getCompleteGuildLogState, getGuildConfig } = require('../db');
        const state = await getCompleteGuildLogState(guild.id);

        // 1. Ignore & Event Filter Check
        const canLog = await shouldLogEvent(guild.id, eventName, context);
        if (!canLog) return null;

        // 2. Map legacy types to new categories if needed
        let category = categoryOrType;
        if (category === 'text' || category === 'general') category = 'message';
        else if (category === 'room') category = 'voice';
        else if (category === 'system') category = 'guild';

        // 3. Resolve Target Channel
        let targetChannelId = state.channels[category];

        // Fallback to legacy config if not set in new table
        if (!targetChannelId) {
            const config = await getGuildConfig(guild.id);
            if (config) {
                if (category === 'voice' && config.log_voice_channel_id) targetChannelId = config.log_voice_channel_id;
                else if (category === 'ticket' && config.log_ticket_channel_id) targetChannelId = config.log_ticket_channel_id;
                else if (category === 'guild' && config.log_system_channel_id) targetChannelId = config.log_system_channel_id;
                else targetChannelId = config.log_channel_id;
            }
        }

        if (targetChannelId) {
            const channel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);
            if (channel) {
                return await channel.send(payload).catch(() => null);
            }
        }
    } catch (err) {
        console.error("[Logger] sendLog hatası:", err);
    }
    return null;
}

async function logGlobalAction(guildId, userId, actionType, actionDetail) {
    if (!guildId) return;
    const { shouldBypassLog } = require('./systemNode');
    if (shouldBypassLog(userId)) return;

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

module.exports = { sendErrorLog, sendActionLog, sendVoiceLog, sendLog, shouldLogEvent, logGlobalAction };
