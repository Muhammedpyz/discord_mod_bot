/**
 * SOSYAL MEDYA BİLDİRİM POLLER'I — V2 + butonlu, mesaj-spam yok (tek mesaj edit).
 * - YouTube: RSS feed (API anahtarı GEREKMEZ)
 * - Twitch : Helix API (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET gerekir, yoksa sessiz geç)
 * - Kick    : Public API (anahtar gerekmez)
 * Kural: yeni video/canlı = TEK yeni V2 mesaj; canlı bitişi = AYNI mesaj editlenir.
 */
const db = require('../db');
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage } = require('./uiBuilder');

let twitchTokenCache = { token: null, expiresAt: 0 };

async function getTwitchToken() {
    if (twitchTokenCache.token && Date.now() < twitchTokenCache.expiresAt) return twitchTokenCache.token;
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    try {
        const res = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`
        });
        if (!res.ok) return null;
        const data = await res.json();
        twitchTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
        return data.access_token;
    } catch (e) {
        console.error('[Social] Twitch token hatası:', e.message);
        return null;
    }
}

async function fetchYouTubeLatest(identifier) {
    const isChannelId = /^UC[\w-]{22}$/.test(identifier);
    const url = isChannelId
        ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(identifier)}`
        : `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(identifier)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NyxBot/1.0' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`YouTube feed HTTP ${res.status}`);
    const xml = await res.text();
    const idMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = xml.match(/<media:title>([^<]+)<\/media:title>/);
    const urlMatch = xml.match(/<link rel="alternate" href="([^"]+)"/);
    if (!idMatch) return null;
    return {
        videoId: idMatch[1],
        title: titleMatch ? decodeHTMLEntities(titleMatch[1]) : 'Yeni video',
        url: urlMatch ? urlMatch[1] : `https://www.youtube.com/watch?v=${idMatch[1]}`
    };
}

async function fetchTwitchLive(login) {
    const token = await getTwitchToken();
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!token || !clientId) return null;
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
        headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stream = data.data && data.data[0];
    return stream
        ? { isLive: true, title: stream.title, game: stream.game_name, viewer: stream.viewer_count }
        : { isLive: false };
}

async function fetchKickLive(slug) {
    try {
        const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
            headers: { 'User-Agent': 'NyxBot/1.0', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { isLive: Boolean(data.livestream), title: (data.livestream && data.livestream.session_title) || null };
    } catch (e) {
        return null;
    }
}

function decodeHTMLEntities(str) {
    return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function formatTemplate(template, vars) {
    let t = template || '{platform} • {title}';
    for (const [k, v] of Object.entries(vars)) {
        t = t.split(`{${k}}`).join(v ?? '');
    }
    return t;
}

function linkRow(url, label) {
    if (!url) return null;
    try {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(String(label).slice(0, 80)).setURL(url)
        );
    } catch { return null; }
}

/** Canlı yayın bittiğinde AYNI mesajı "sona erdi" durumuna çevir (yeni mesaj spam'i yok). */
async function editLiveEnd(channel, liveMessageId, platformName, name) {
    if (!liveMessageId) return;
    try {
        const msg = await channel.messages.fetch(liveMessageId).catch(() => null);
        if (!msg) return;
        const payload = createContainerMessage(
            `${platformName} Yayını Sona Erdi`,
            `**${name}** adlı yayıncının canlı yayını sona erdi.\n-# Bir sonraki yayında bildirim alacaksınız.`,
            '#2B2D31'
        );
        await msg.edit({ ...payload, flags: MessageFlags.IsComponentsV2, components: payload.components }).catch(() => {});
    } catch {}
}

async function checkSocialAlerts(client) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const subs = await conn.query('SELECT * FROM social_subscriptions');
        if (!subs || subs.length === 0) return;

        for (const sub of subs) {
            try {
                const channel = client.channels.cache.get(sub.discord_channel_id);
                if (!channel || !channel.isTextBased()) continue;

                if (sub.platform === 'youtube') {
                    let latest;
                    try { latest = await fetchYouTubeLatest(sub.channel_identifier); } catch (e) {
                        console.error(`[Social] YT #${sub.id}:`, e.message);
                        continue;
                    }
                    if (!latest) continue;
                    if (sub.last_seen_id && latest.videoId === sub.last_seen_id) continue;

                    const vars = { platform: 'YouTube', title: latest.title, url: latest.url, name: sub.channel_identifier };
                    const content = formatTemplate(sub.message_template, vars);
                    const row = linkRow(latest.url, 'Videoyu İzle');
                    const payload = createContainerMessage('Yeni YouTube Videosu!', `${content}\n\n${latest.url}`, '#FF0000', row ? [row] : []);
                    await channel.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                    await conn.query('UPDATE social_subscriptions SET last_seen_id = ? WHERE id = ?', [latest.videoId, sub.id]);
                } else if (sub.platform === 'twitch') {
                    const live = await fetchTwitchLive(sub.channel_identifier);
                    if (!live) continue;
                    if (live.isLive && !sub.is_currently_live) {
                        const url = `https://twitch.tv/${sub.channel_identifier}`;
                        const vars = { platform: 'Twitch', title: live.title, url, name: sub.channel_identifier, game: live.game, viewers: live.viewer };
                        const content = formatTemplate(sub.message_template, vars);
                        const row = linkRow(url, 'Yayını İzle');
                        const payload = createContainerMessage(
                            'Canlı Yayın Başladı!',
                            `${content}\n\n**Oyun:** ${live.game || '—'}\n**İzleyici:** ${live.viewer ?? '—'}\n${url}`,
                            '#9146FF', row ? [row] : []
                        );
                        const sent = await channel.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => null);
                        await conn.query('UPDATE social_subscriptions SET is_currently_live = TRUE, live_message_id = ? WHERE id = ?', [sent ? sent.id : null, sub.id]);
                    } else if (!live.isLive && sub.is_currently_live) {
                        await editLiveEnd(channel, sub.live_message_id, 'Twitch', sub.channel_identifier);
                        await conn.query('UPDATE social_subscriptions SET is_currently_live = FALSE, live_message_id = NULL WHERE id = ?', [sub.id]);
                    }
                } else if (sub.platform === 'kick') {
                    const live = await fetchKickLive(sub.channel_identifier);
                    if (!live) continue;
                    if (live.isLive && !sub.is_currently_live) {
                        const url = `https://kick.com/${sub.channel_identifier}`;
                        const vars = { platform: 'Kick', title: live.title || 'Canlı yayın', url, name: sub.channel_identifier };
                        const content = formatTemplate(sub.message_template, vars);
                        const row = linkRow(url, 'Yayını İzle');
                        const payload = createContainerMessage('Canlı Yayın Başladı!', `${content}\n\n${url}`, '#53FC18', row ? [row] : []);
                        const sent = await channel.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => null);
                        await conn.query('UPDATE social_subscriptions SET is_currently_live = TRUE, live_message_id = ? WHERE id = ?', [sent ? sent.id : null, sub.id]);
                    } else if (!live.isLive && sub.is_currently_live) {
                        await editLiveEnd(channel, sub.live_message_id, 'Kick', sub.channel_identifier);
                        await conn.query('UPDATE social_subscriptions SET is_currently_live = FALSE, live_message_id = NULL WHERE id = ?', [sub.id]);
                    }
                }
            } catch (e) {
                console.error(`[Social] Abonelik #${sub.id} işlenirken hata:`, e.message);
            }
        }
    } catch (e) {
        console.error('[Social] Poller hatası:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { checkSocialAlerts };
