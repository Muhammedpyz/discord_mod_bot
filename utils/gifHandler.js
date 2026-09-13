const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildModBResponse, MONO_EMOJIS } = require('./uiBuilder');

// konu -> sağlayıcı eşleşmesi (Tenor key yoksa key gerektirmeyen CDN'ler)
const PROVIDERS = {
    saril: { type: 'purrbot', path: 'hug', label: 'Sarılma' },
    opucuk: { type: 'purrbot', path: 'kiss', label: 'Öpücük' },
    oksama: { type: 'purrbot', path: 'pat', label: 'Okşama' },
    tokat: { type: 'purrbot', path: 'slap', label: 'Tokat' },
    dans: { type: 'purrbot', path: 'dance', label: 'Dans' },
    kucaklasma: { type: 'purrbot', path: 'cuddle', label: 'Kucaklaşma' },
    besle: { type: 'purrbot', path: 'feed', label: 'Besleme' },
    kedi: { type: 'cataas', label: 'Kedi' },
    kopek: { type: 'randomdog', label: 'Köpek' }
};

async function fetchJson(url, timeoutMs = 10000) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'NyxBot/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchTenor(query) {
    const key = process.env.TENOR_API_KEY;
    if (!key) return null;
    const data = await fetchJson(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${key}&limit=8&media_filter=gif&contentfilter=medium&locale=tr_TR`
    );
    const list = (data.results || [])
        .map(r => r.media_formats && r.media_formats.gif && r.media_formats.gif.url)
        .filter(Boolean);
    if (list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
}

async function fetchGiphy(query) {
    const key = process.env.GIPHY_API_KEY;
    if (!key) return null;
    const data = await fetchJson(
        `https://api.giphy.com/v1/gifs/translate?api_key=${key}&s=${encodeURIComponent(query)}&rating=pg-13&lang=tr`
    );
    const url = data.data && data.data.images && data.data.images.original && data.data.images.original.url;
    return url || null;
}

/** Serbest arama: Giphy (yoksa Tenor) dener, bulamazsa null döner. */
async function searchGif(query) {
    if (process.env.GIPHY_API_KEY) {
        try {
            const g = await fetchGiphy(query);
            if (g) return g;
        } catch {}
    }
    if (process.env.TENOR_API_KEY) {
        try {
            const t = await fetchTenor(query);
            if (t) return t;
        } catch {}
    }
    return null;
}

/**
 * Eğlence kartı: GIF bulunursa resimli V2 kart, bulunamazsa sade kart.
 * Kullanım: const payload = await funCard('Başlık', ['satır'], [row], 'love kiss');
 */
async function funCard(title, lines, rows, query) {
    const { buildModBResponse, createContainerMessage } = require('./uiBuilder');
    if (query) {
        try {
            const url = await searchGif(query);
            if (url) {
                return buildModBResponse({ title, textLines: lines, actionRows: rows || [], images: [url] });
            }
        } catch {}
    }
    return createContainerMessage(title, lines.join('\n'), '#5865F2', rows || []);
}

async function fetchGif(konu) {
    const p = PROVIDERS[konu] || PROVIDERS.saril;

    // 1) Tenor key varsa öncelik Tenor'da
    if (process.env.TENOR_API_KEY) {
        try {
            const t = await fetchTenor(p.label);
            if (t) return t;
        } catch {}
    }

    // 2) Giphy key varsa Giphy'den dene
    if (process.env.GIPHY_API_KEY) {
        try {
            const g = await fetchGiphy(`${p.label} gif`);
            if (g) return g;
        } catch {}
    }

    // 2) Key gerektirmeyen kaynaklar
    if (p.type === 'purrbot') {
        const data = await fetchJson(`https://api.purrbot.site/v2/img/sfw/${p.path}/gif`);
        if (data && data.link) return data.link;
        throw new Error('GIF alınamadı');
    }
    if (p.type === 'cataas') {
        return `https://cataas.com/cat/gif?t=${Date.now()}`;
    }
    if (p.type === 'randomdog') {
        for (let i = 0; i < 5; i++) {
            const data = await fetchJson('https://random.dog/woof.json');
            if (data && data.url && data.url.endsWith('.gif')) return data.url;
        }
        const data = await fetchJson('https://random.dog/woof.json');
        return data.url;
    }
    throw new Error('Bilinmeyen konu');
}

function gifCard(url, konu, hedefId) {
    const p = PROVIDERS[konu] || PROVIDERS.saril;
    const baslik = hedefId ? `${p.label} GIF` : `${p.label} GIF`;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gif_${konu}_${hedefId || '0'}`)
            .setLabel('Yeni GIF')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.refresh)
    );
    return buildModBResponse({
        title: baslik,
        textLines: [hedefId && hedefId !== '0' ? `<@${hedefId}> için gelsin!` : 'Al sana rastgele bir GIF!'],
        actionRows: [row],
        images: [url]
    });
}

async function handleGifInteractions(interaction) {
    await interaction.deferUpdate().catch(() => {});
    const parts = interaction.customId.split('_');
    const konu = parts[1] || 'saril';
    const hedef = parts[2] && parts[2] !== '0' ? parts[2] : null;
    try {
        const url = await fetchGif(konu);
        await interaction.editReply({ ...gifCard(url, konu, hedef), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    } catch (e) {
        console.error('[GIF] Hata:', e.message);
        await interaction.followUp({ content: 'GIF alınırken bir sorun oluştu, tekrar dene.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}

module.exports = { fetchGif, gifCard, handleGifInteractions, PROVIDERS, searchGif, funCard };
