const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

const FEED_APIS = {
    memes: async () => {
        try {
            const res = await fetch('https://meme-api.com/gimme');
            if (!res.ok) return null;
            const data = await res.json();
            return {
                title: data.title || 'Günün Mizahı',
                image: data.url,
                footer: `r/${data.subreddit} | Upvotes: ${data.ups}`
            };
        } catch (e) {
            return null;
        }
    },
    anime: async () => {
        try {
            const res = await fetch('https://nekos.best/api/v2/neko');
            if (!res.ok) return null;
            const data = await res.json();
            const item = data.results && data.results[0];
            if (!item) return null;
            return {
                title: `${item.artist_name || 'Anime Art'}`,
                image: item.url,
                footer: `Sanatçı: ${item.artist_name || 'Bilinmiyor'}`
            };
        } catch (e) {
            return null;
        }
    },
    wallpaper: async () => {
        try {
            const res = await fetch('https://picsum.photos/1920/1080');
            if (!res.url) return null;
            return {
                title: 'Günün Duvar Kağıdı (HD Wallpaper)',
                image: res.url,
                footer: 'Picsum HD Wallpapers'
            };
        } catch (e) {
            return null;
        }
    }
};

function initAutoPostScheduler(client) {
    // Her 30 dakikada bir kontrol et ve içerik gönder
    setInterval(async () => {
        try {
            const configs = await db.getAutoPostConfigs().catch(() => []);
            if (!configs || configs.length === 0) return;

            const now = Date.now();
            const intervalMs = 30 * 60 * 1000; // 30 Dakika

            for (const cfg of configs) {
                if (now - (cfg.last_post_time || 0) < intervalMs) continue;

                const guild = client.guilds.cache.get(cfg.guild_id);
                if (!guild) continue;

                const channel = guild.channels.cache.get(cfg.channel_id);
                if (!channel) continue;

                const fetcher = FEED_APIS[cfg.feed_type];
                if (!fetcher) continue;

                const content = await fetcher();
                if (!content || !content.image) continue;

                const icon = cfg.feed_type === 'memes' ? (MONO_EMOJIS.fun || '1537767765103083541') :
                             cfg.feed_type === 'anime' ? (MONO_EMOJIS.star || '1530917515227725834') :
                             (MONO_EMOJIS.image || '1537767789098307615');

                const title = `<:mono:${icon}> ${content.title}`;
                const desc = `Otomatik içerik akışı (${cfg.feed_type.toUpperCase()})`;
                const postMsg = createContainerMessage(title, desc, '#5865F2', [], [], false);

                // Görseli mesaja ekle
                await channel.send({
                    ...postMsg,
                    files: [content.image]
                }).catch(() => {});

                await db.updateAutoPostTime(cfg.id, now).catch(() => {});
            }
        } catch (e) {
            console.error('[AutoPost Scheduler Error]:', e);
        }
    }, 5 * 60 * 1000); // 5 dakikada bir kuyruğu tara
}

module.exports = {
    initAutoPostScheduler
};
