/**
 * STARBOARD — V2 + butonlu kart, TEK mesaj edit (spam yok).
 * Kural: V2 flag açıkken `content` alanı YASAK — yıldız sayısı TextDisplay içindedir.
 */
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage } = require('./uiBuilder');

/** Config'deki emoji (ID, <:ad:id> veya unicode ad) ile reaction'ı eşleştirir. */
function matchesEmoji(reaction, configEmoji) {
    const cfg = String(configEmoji || '').trim();
    if (!cfg) return false;
    if (/^\d+$/.test(cfg)) return reaction.emoji.id === cfg; // saf ID (mono emoji)
    const idMatch = cfg.match(/:(\d+)>?$/);
    if (idMatch && reaction.emoji.id) return reaction.emoji.id === idMatch[1];
    const reactionEmoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    return reactionEmoji === cfg || reaction.emoji.name === cfg;
}

/** Karttaki sayaç için config emojisini metne çevirir (mono ID ise etiket formu). */
function displayEmoji(configEmoji) {
    const cfg = String(configEmoji || '').trim();
    if (/^\d+$/.test(cfg)) return `<:mono:${cfg}>`;
    return cfg;
}

function buildStarboardPayload({ starCount, emoji, channelId, content, url, authorTag, imageUrl }) {    const header = `**${starCount}** ${displayEmoji(emoji)} | <#${channelId}>`;
    const body = `${header}\n\n**${authorTag || 'Bilinmeyen'}:**\n${content || '*[Sadece görsel veya dosya]*'}`;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Mesaja Git').setURL(url)
    );
    const payload = createContainerMessage('Yıldız Panosu', body, '#FEE75C', [row], [], false);
    if (imageUrl) {
        // V2 kartına görseli metin olarak ekle (MediaGallery karmaşasından kaçınmak için sade tut)
        payload.components[0].components.splice(1, 0, { type: 10, content });
    }
    return payload;
}

async function renderStarboardEntry(client, guildId, originalMessageId) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const configs = await conn.query('SELECT * FROM starboard_config WHERE guild_id = ?', [guildId]);
        if (configs.length === 0) return;
        const config = configs[0];

        const entries = await conn.query('SELECT * FROM starboard_entries WHERE guild_id = ? AND original_message_id = ?', [guildId, originalMessageId]);
        if (entries.length === 0) return;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        const sbChannel = guild.channels.cache.get(config.channel_id);
        if (!sbChannel || !sbChannel.isTextBased()) return;

        // Orijinal mesajı bul (sayı + içerik tazele)
        let origMsg = null;
        for (const ch of guild.channels.cache.values()) {
            if (!ch.isTextBased()) continue;
            try {
                const m = await ch.messages.fetch(originalMessageId).catch(() => null);
                if (m) { origMsg = m; break; }
            } catch {}
        }

        const sbMsg = await sbChannel.messages.fetch(entries[0].starboard_message_id).catch(() => null);
        if (!sbMsg) {
            await conn.query('DELETE FROM starboard_entries WHERE guild_id = ? AND original_message_id = ?', [guildId, originalMessageId]);
            return;
        }

        const starCount = entries[0].star_count;
        const reaction = origMsg
            ? origMsg.reactions.cache.find(r => matchesEmoji(r, config.emoji))
            : null;
        const liveCount = reaction ? reaction.count : starCount;

        if (liveCount < config.threshold) {
            await sbMsg.delete().catch(() => {});
            await conn.query('DELETE FROM starboard_entries WHERE guild_id = ? AND original_message_id = ?', [guildId, originalMessageId]);
            return;
        }

        const text = origMsg ? (origMsg.content || '') : '';
        const img = origMsg && origMsg.attachments.size > 0
            ? origMsg.attachments.find(a => a.contentType && a.contentType.startsWith('image/'))?.url
            : null;
        const payload = buildStarboardPayload({
            starCount: liveCount,
            emoji: config.emoji,
            channelId: origMsg ? origMsg.channel.id : entries[0].star_count,
            content: text.slice(0, 1500),
            url: origMsg ? origMsg.url : `https://discord.com/channels/${guildId}/${entries[0].starboard_message_id}`,
            authorTag: origMsg ? (origMsg.author.tag || origMsg.author.username) : null,
            imageUrl: img
        });
        await sbMsg.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        if (liveCount !== starCount) {
            await conn.query('UPDATE starboard_entries SET star_count = ? WHERE guild_id = ? AND original_message_id = ?', [liveCount, guildId, originalMessageId]);
        }
    } catch (e) {
        console.error('[Starboard] render hatası:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

async function upsertStarboard(client, message, config, starCount) {
    const sbChannel = client.channels.cache.get(config.channel_id);
    if (!sbChannel || !sbChannel.isTextBased()) return;
    let conn;
    try {
        conn = await db.pool.getConnection();
        const entries = await conn.query('SELECT * FROM starboard_entries WHERE guild_id = ? AND original_message_id = ?', [message.guild.id, message.id]);
        const img = message.attachments.size > 0
            ? message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'))?.url
            : null;
        const payload = buildStarboardPayload({
            starCount, emoji: config.emoji, channelId: message.channel.id,
            content: (message.content || '').slice(0, 1500), url: message.url,
            authorTag: message.author.tag || message.author.username, imageUrl: img
        });
        if (entries.length > 0) {
            // AYNI mesajı düzenle — yeni mesaj YOK
            const sbMsg = await sbChannel.messages.fetch(entries[0].starboard_message_id).catch(() => null);
            if (sbMsg) {
                await sbMsg.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                await conn.query('UPDATE starboard_entries SET star_count = ? WHERE guild_id = ? AND original_message_id = ?', [starCount, message.guild.id, message.id]);
            } else {
                const sent = await sbChannel.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => null);
                if (sent) await conn.query('UPDATE starboard_entries SET starboard_message_id = ?, star_count = ? WHERE guild_id = ? AND original_message_id = ?', [sent.id, starCount, message.guild.id, message.id]);
            }
        } else {
            const sent = await sbChannel.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => null);
            if (sent) {
                await conn.query('INSERT INTO starboard_entries (guild_id, original_message_id, starboard_message_id, star_count) VALUES (?, ?, ?, ?)', [message.guild.id, message.id, sent.id, starCount]);
            }
        }
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { buildStarboardPayload, renderStarboardEntry, upsertStarboard, matchesEmoji, displayEmoji };
