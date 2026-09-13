const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, buildModBResponse, MONO_EMOJIS } = require('./uiBuilder');

// Yenile butonları için kısa ömürlü parametre önbelleği
const bilgiCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of bilgiCache.entries()) {
        if (now - v.t > 30 * 60 * 1000) bilgiCache.delete(k);
    }
}, 10 * 60 * 1000);

function cacheId() {
    return Date.now().toString(36) + Math.floor(Math.random() * 9999).toString(36);
}

function refreshRow(id) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bilgi_yenile_${id}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
    )];
}

async function fetchJson(url, timeoutMs = 12000) {
    const res = await fetch(url, { headers: { 'User-Agent': 'NyxBot/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

const WMO = { 0: 'Açık', 1: 'Genelde açık', 2: 'Parçalı bulutlu', 3: 'Kapalı', 45: 'Sisli', 48: 'Kırağılı sis', 51: 'Hafif çisenti', 53: 'Çisenti', 55: 'Yoğun çisenti', 61: 'Hafif yağmur', 63: 'Yağmur', 65: 'Şiddetli yağmur', 71: 'Hafif kar', 73: 'Kar', 75: 'Yoğun kar', 77: 'Kar taneleri', 80: 'Hafif sağanak', 81: 'Sağanak', 82: 'Şiddetli sağanak', 95: 'Gök gürültülü', 96: 'Dolulu fırtına', 99: 'Şiddetli dolulu fırtına' };

async function getHava(sehir) {
    const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sehir)}&count=1&language=tr&format=json`);
    if (!geo.results || geo.results.length === 0) throw new Error('Şehir bulunamadı');
    const g = geo.results[0];
    const f = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
    const c = f.current;
    const body = `**${g.name}, ${g.country || ''}**\n\n**Durum:** ${WMO[c.weather_code] || 'Bilinmiyor'}\n**Sıcaklık:** ${c.temperature_2m}°C (hissedilen ${c.apparent_temperature}°C)\n**Gün:** ${f.daily.temperature_2m_min[0]}° / ${f.daily.temperature_2m_max[0]}°\n**Nem:** %${c.relative_humidity_2m}\n**Rüzgar:** ${c.wind_speed_10m} km/s`;
    return { title: 'Hava Durumu', body };
}

async function getCeviri(metin, hedef) {
    const data = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(metin.slice(0, 400))}&langpair=autodetect|${hedef}`);
    const cev = data.responseData && data.responseData.translatedText;
    if (!cev) throw new Error('Çeviri alınamadı');
    return { title: 'Çeviri', body: `**Orijinal:**\n${metin.slice(0, 500)}\n\n**Çeviri (${hedef}):**\n${cev}` };
}

async function getKripto(id) {
    const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id.toLowerCase())}&vs_currencies=usd,try&include_24hr_change=true`);
    const k = Object.keys(data)[0];
    if (!k) throw new Error('Coin bulunamadı');
    const v = data[k];
    const deg = v.usd_24h_change != null ? v.usd_24h_change.toFixed(2) : '?';
    const body = `**${k.toUpperCase()}**\n\n**USD:** $${Number(v.usd).toLocaleString('en-US')}\n**TRY:** ${Number(v.try).toLocaleString('tr-TR')} TL\n**24s değişim:** %${deg}`;
    return { title: 'Kripto', body };
}

async function getDoviz() {
    const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (data.result !== 'success') throw new Error('Kur alınamadı');
    const r = data.rates;
    const body = `**Dolar (USD):** ${Number(r.TRY).toFixed(2)} TL\n**Euro (EUR):** ${(Number(r.TRY) / Number(r.EUR)).toFixed(2)} TL\n**Sterlin (GBP):** ${(Number(r.TRY) / Number(r.GBP)).toFixed(2)} TL\n\n-# Kaynak: açık kur verisi`;
    return { title: 'Döviz Kurları', body };
}

async function getKisalt(url) {
    const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, { headers: { 'User-Agent': 'NyxBot/1.0' }, signal: AbortSignal.timeout(10000) });
    const txt = (await res.text()).trim();
    if (!txt.startsWith('https://')) throw new Error('Kısaltılamadı');
    return { title: 'Link Kısaltma', body: `**Orijinal:** ${url.slice(0, 200)}\n\n**Kısa:** ${txt}` };
}

async function getWiki(terim) {
    const data = await fetchJson(`https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(terim)}`);
    if (!data.extract) throw new Error('Bulunamadı');
    const body = `**${data.title}**\n\n${data.extract.slice(0, 1500)}${data.content_urls?.desktop?.page ? `\n\n[Devamını Oku](${data.content_urls.desktop.page})` : ''}`;
    return { title: 'Wikipedia', body };
}

async function getGithub(repo) {
    const data = await fetchJson(`https://api.github.com/repos/${repo}`);
    const body = `**${data.full_name}**\n\n${(data.description || 'Açıklama yok.').slice(0, 500)}\n\n**Yıldız:** ${data.stargazers_count} • **Fork:** ${data.forks_count} • **Dil:** ${data.language || '—'}\n**Açık issue:** ${data.open_issues_count}\n\n${data.html_url}`;
    return { title: 'GitHub', body };
}

async function getNpm(pkg) {
    const data = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
    const body = `**${data.name}@${data.version}**\n\n${(data.description || 'Açıklama yok.').slice(0, 500)}\n\n**Lisans:** ${data.license || '—'}`;
    return { title: 'npm', body };
}

const FETCHERS = { hava: getHava, ceviri: getCeviri, kripto: getKripto, doviz: getDoviz, kisalt: getKisalt, wiki: getWiki, github: getGithub, npm: getNpm };

async function runBilgi(interaction, tur, ...args) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    try {
        const fn = FETCHERS[tur];
        if (!fn) throw new Error('Bilinmeyen sorgu');
        const { title, body } = await fn(...args);
        const id = cacheId();
        bilgiCache.set(id, { tur, args, t: Date.now() });
        await interaction.editReply(createContainerMessage(title, body, '#5865F2', refreshRow(id)));
    } catch (e) {
        console.error(`[Bilgi:${tur}]:`, e.message);
        await interaction.editReply(createContainerMessage('Hata', 'Bilgi alınamadı, yazımı kontrol edip tekrar dene.', '#ED4245', [], [], false, true)).catch(() => {});
    }
}

async function handleBilgiInteractions(interaction) {
    if (!interaction.customId.startsWith('bilgi_yenile_')) return;
    await interaction.deferUpdate().catch(() => {});
    const id = interaction.customId.split('_')[2];
    const c = bilgiCache.get(id);
    if (!c) {
        return interaction.followUp(createContainerMessage('Bilgi', 'Bu kart eskimiş, komutu tekrar çalıştır.', '#FEE75C', [], [], false, true)).catch(() => {});
    }
    try {
        const { title, body } = await FETCHERS[c.tur](...c.args);
        await interaction.editReply(createContainerMessage(title, body, '#5865F2', refreshRow(id))).catch(() => {});
    } catch (e) {
        await interaction.followUp(createContainerMessage('Hata', 'Yenilenemedi.', '#ED4245', [], [], false, true)).catch(() => {});
    }
}

module.exports = { runBilgi, handleBilgiInteractions };
