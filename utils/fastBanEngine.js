'use strict';

const { Pool } = require('undici');
const os = require('node:os');

// İşlemci önceliğini optimize et (Hızlı yanıt)
try { os.setPriority(process.pid, -10); } catch {}

const discordPool = new Pool('https://discord.com', {
    allowH2: true,
    connections: 4,
    pipelining: 1,
    keepAliveTimeout: 20000,
    keepAliveMaxTimeout: 20000
});

const _banPathCache = new Map();
const getBanPath = (guildId, userId) => {
    const k = `${guildId}:${userId}`;
    let p = _banPathCache.get(k);
    if (!p) {
        p = `/api/v10/guilds/${guildId}/bans/${userId}`;
        _banPathCache.set(k, p);
    }
    return p;
};

const _deleteChannelPath = (channelId) => `/api/v10/channels/${channelId}`;
const _deleteWebhookPath = (webhookId) => `/api/v10/webhooks/${webhookId}`;

/**
 * Ultra Hızlı HTTP/2 Direct Ban
 * @param {string} guildId 
 * @param {string} userId 
 * @param {string} reason 
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
async function fastBan(guildId, userId, reason = 'Anti-Nuke: Acil Güvenlik İnfazı', token = process.env.DISCORD_TOKEN) {
    if (!token || !guildId || !userId) return false;
    const path = getBanPath(guildId, userId);
    const body = Buffer.from(JSON.stringify({ delete_message_seconds: 0 }));

    return new Promise((resolve) => {
        discordPool.request({
            path,
            method: 'PUT',
            headers: {
                'authorization': `Bot ${token}`,
                'content-type': 'application/json',
                'content-length': String(body.byteLength),
                'x-audit-log-reason': encodeURIComponent(reason.substring(0, 500))
            },
            body
        }, (err, data) => {
            if (err) {
                console.error('[FastBan HTTP/2 Error]:', err.message);
                return resolve(false);
            }
            if (data && data.body) data.body.resume();
            resolve(data && data.statusCode >= 200 && data.statusCode < 300);
        });
    });
}

/**
 * Ultra Hızlı HTTP/2 Direct Webhook Silme
 * @param {string} webhookId 
 * @param {string} reason 
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
async function fastDeleteWebhook(webhookId, reason = 'Anti-Nuke: Yetkisiz Webhook', token = process.env.DISCORD_TOKEN) {
    if (!token || !webhookId) return false;
    const path = _deleteWebhookPath(webhookId);

    return new Promise((resolve) => {
        discordPool.request({
            path,
            method: 'DELETE',
            headers: {
                'authorization': `Bot ${token}`,
                'x-audit-log-reason': encodeURIComponent(reason.substring(0, 500))
            }
        }, (err, data) => {
            if (err) return resolve(false);
            if (data && data.body) data.body.resume();
            resolve(data && data.statusCode >= 200 && data.statusCode < 300);
        });
    });
}

module.exports = {
    fastBan,
    fastDeleteWebhook,
    discordPool
};
