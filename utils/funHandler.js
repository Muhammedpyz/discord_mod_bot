const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

const BALL = [
    'Kesinlikle evet.', 'Hiç şüphesiz öyle.', 'Büyük ihtimalle evet.', 'Olumlu görünüyor.',
    'Belirtiler evet diyor.', 'Evet.', 'Cevap puslu, tekrar dene.', 'Şimdi söylemesem daha iyi.',
    'Konsantre ol ve tekrar sor.', 'Buna güvenme.', 'Cevabım hayır.', 'Kaynaklarım hayır diyor.',
    'Pek iyi görünmüyor.', 'Çok şüpheli.', 'Yıldızlar hayır diyor.', 'Kesinlikle hayır.',
    'Zamanı gelince anlayacaksın.', 'Evet, ama acele etme.', 'Hayır, başka kapıya.',
    'Olabilir, ama garanti yok.'
];

const JOKES = [
    'Adamın biri güneşte yanmış, ayda düzleşmiş.',
    'Küçük su birikintisine ne denir? Sucuk.',
    'En çok eşek yavrusu nerede bulunur? Eşeklerin yanında.',
    'Adamın kafasına tabelayı takmışlar, adam tabelacı olmuş.',
    'Sivrisinekler en çok hangi kan grubunu sever? Damar grubunu.',
    'Hangi bağda üzüm yetişmez? Voleybol bağında.',
    'Adamın biri gülmüş, bahçeye düşmüş. Neden? Çünkü gül bahçesiymiş.',
    'En hızlı sayı hangisidir? 10. Neden? Çünkü 10 saniyede söylenir.',
    'Balıklar neden konuşmaz? Çünkü ağızları suyla doludur.',
    'Hangi kalemle yazı yazılmaz? Kontrol kalemiyle.',
    'Adam buzdolabına girmiş, neden? Serinlemek için.',
    'Tavuklar neden yolun karşısına geçer? Öbür tarafa geçmek için.',
    'Bilgisayar neden üşür? Windows açık kalmış.',
    'Hangi ayda 28 gün vardır? Hepsinde.',
    'Deniz neden tuzludur? Balıklar terlediği için.'
];

function rerollRow(kind, extra) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(extra ? `fun_${kind}_${extra}` : `fun_${kind}`).setLabel('Tekrar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
    )];
}

function ballAnswer(q) {
    let h = 0;
    for (const c of q) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return BALL[h % BALL.length];
}

function askPercent(a, b) {
    const s = [a, b].sort().join('|');
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 101;
}

function bar(p) {
    const f = Math.round(p / 10);
    return '█'.repeat(f) + '░'.repeat(10 - f);
}

async function handleFunInteractions(interaction) {
    const { customId } = interaction;

    if (customId === 'fun_8ball') {
        await interaction.deferUpdate().catch(() => {});
        await interaction.editReply(createContainerMessage('Sihirli 8 Topu', ballAnswer(String(Date.now())), '#5865F2', rerollRow('8ball'))).catch(() => {});
        return;
    }

    if (customId.startsWith('fun_zar_')) {
        await interaction.deferUpdate().catch(() => {});
        const [, , adet, yuz] = customId.split('_');
        const a = Math.max(1, Math.min(10, parseInt(adet, 10) || 1));
        const y = Math.max(2, Math.min(100, parseInt(yuz, 10) || 6));
        const rolls = [];
        for (let i = 0; i < a; i++) rolls.push(1 + Math.floor(Math.random() * y));
        const total = rolls.reduce((x, v) => x + v, 0);
        await interaction.editReply(createContainerMessage('Zar', `**${a}** adet **${y}** yüzlü zar:\n\`${rolls.join(' • ')}\`\n\n**Toplam:** ${total}`, '#5865F2', rerollRow('zar', `${a}_${y}`))).catch(() => {});
        return;
    }

    if (customId === 'fun_yazi') {
        await interaction.deferUpdate().catch(() => {});
        const r = Math.random() < 0.5 ? 'Yazı' : 'Tura';
        await interaction.editReply(createContainerMessage('Yazı Tura', `Para havaya atıldı...\n\n**Sonuç: ${r}**`, '#5865F2', rerollRow('yazi'))).catch(() => {});
        return;
    }

    if (customId.startsWith('fun_ask_')) {
        await interaction.deferUpdate().catch(() => {});
        const [, , a, b] = customId.split('_');
        const p = askPercent(a, b);
        const { funCard: fcAsk } = require('./gifHandler');
        const vtxt = p >= 80 ? 'Efsane uyum!' : p >= 50 ? 'İyi anlaşırsınız.' : p >= 25 ? 'Biraz çaba lazım.' : 'Kaçınılmaz son...';
        const vq = p >= 80 ? 'love kiss' : p >= 50 ? 'hug' : p >= 25 ? 'friends' : 'breakup';
        const payload = await fcAsk('Aşk Ölçer', [`<@${a}> + <@${b}>`, '', `\`${bar(p)}\` %${p}`, '', `-# ${vtxt}`], rerollRow('ask', `${a}_${b}`), vq);
        await interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    if (customId === 'fun_espri') {
        await interaction.deferUpdate().catch(() => {});
        const { funCard: fcEsp } = require('./gifHandler');
        const payload = await fcEsp('Espri', [JOKES[Math.floor(Math.random() * JOKES.length)]], rerollRow('espri'), 'funny laugh');
        await interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    if (customId.startsWith('roast_')) {
        await interaction.deferUpdate().catch(() => {});
        const hedef = customId.split('_')[1];
        const { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
        const ROASTS = ['Senin fikirlerin Wi-Fi gibi: var gibi görünüp bir türlü bağlanmıyor.', 'Ayna seni görünce parlaklığını kısıyor.', 'Beynin uçak modunda kalmış, indirmeyi unutmuşsun.', 'Google bile seni aramaktan vazgeçti.', 'Şarjın %1 ama hala konuşuyorsun, helal.', 'Senin esprilerin diyet yemek gibi: kimse doymuyor.', 'Kahve bile seni ayıltamadıysa sorun büyük.', 'Profil fotoğrafın bile seni tanımıyor.'];
        const row = new AR().addComponents(new BB().setCustomId(`roast_${hedef}`).setLabel('Bir Daha').setStyle(BS.Secondary).setEmoji(MONO_EMOJIS.refresh));
        const { funCard: fcRst } = require('./gifHandler');
        const payload = await fcRst('Sataşma', [`<@${hedef}>, ${ROASTS[Math.floor(Math.random() * ROASTS.length)]}`, '', '-# Şaka amaçlıdır, sevgiler!'], [row], 'slap');
        await interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    if (customId === 'fact_yeni') {
        await interaction.deferUpdate().catch(() => {});
        const { ActionRowBuilder: AR2, ButtonBuilder: BB2, ButtonStyle: BS2 } = require('discord.js');
        const FACTS = ['Bal insanlık tarihinin bozulmayan tek gıdasıdır.', 'Ahtapotların 3 kalbi vardır.', 'Kelebekler ayaklarıyla tat alır.', 'Venüs\'te bir gün, bir yıldan uzundur.', 'Zürafalar günde sadece 30 dakika uyur.', 'Penguenler eşlerine çakıl taşı hediye eder.', 'Filler kendilerini aynada tanıyabilir.'];
        const row = new AR2().addComponents(new BB2().setCustomId('fact_yeni').setLabel('Yeni Bilgi').setStyle(BS2.Secondary).setEmoji(MONO_EMOJIS.refresh));
        await interaction.editReply(createContainerMessage('İlginç Bilgi', FACTS[Math.floor(Math.random() * FACTS.length)], '#5865F2', [row])).catch(() => {});
        return;
    }

    if (customId === 'saat_yenile') {        await interaction.deferUpdate().catch(() => {});
        const { ActionRowBuilder: AR3, ButtonBuilder: BB3, ButtonStyle: BS3 } = require('discord.js');
        const ZONES = [['İstanbul', 'Europe/Istanbul'], ['Londra', 'Europe/London'], ['Berlin', 'Europe/Berlin'], ['New York', 'America/New_York'], ['Tokyo', 'Asia/Tokyo'], ['Dubai', 'Asia/Dubai']];
        let body = '';
        for (const [ad, tz] of ZONES) {
            try { body += `**${ad}:** ${new Date().toLocaleTimeString('tr-TR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}\n`; } catch {}
        }
        const row = new AR3().addComponents(new BB3().setCustomId('saat_yenile').setLabel('Yenile').setStyle(BS3.Secondary).setEmoji(MONO_EMOJIS.refresh));
        await interaction.editReply(createContainerMessage('Dünya Saati', body, '#5865F2', [row])).catch(() => {});
        return;
    }

    if (customId === 'kedi_yeni') {
        await interaction.deferUpdate().catch(() => {});
        const { buildModBResponse: BMB } = require('./uiBuilder');
        const { ActionRowBuilder: AR4, ButtonBuilder: BB4, ButtonStyle: BS4 } = require('discord.js');
        const row = new AR4().addComponents(new BB4().setCustomId('kedi_yeni').setLabel('Yeni Kedi').setStyle(BS4.Secondary).setEmoji(MONO_EMOJIS.refresh));
        await interaction.editReply(BMB({ title: 'Kedi', textLines: ['Al sana bir kedi!'], images: [`https://cataas.com/cat?t=${Date.now()}`], actionRows: [row] })).catch(() => {});
        return;
    }

    if (customId === 'kopek_yeni') {
        await interaction.deferUpdate().catch(() => {});
        try {
            const { buildModBResponse: BMB2 } = require('./uiBuilder');
            const { ActionRowBuilder: AR5, ButtonBuilder: BB5, ButtonStyle: BS5 } = require('discord.js');
            const res = await fetch('https://dog.ceo/api/breeds/image/random', { headers: { 'User-Agent': 'NyxBot/1.0' }, signal: AbortSignal.timeout(10000) });
            const d = await res.json();
            const row = new AR5().addComponents(new BB5().setCustomId('kopek_yeni').setLabel('Yeni Köpek').setStyle(BS5.Secondary).setEmoji(MONO_EMOJIS.refresh));
            await interaction.editReply(BMB2({ title: 'Köpek', textLines: ['Al sana bir köpek!'], images: [d.message], actionRows: [row] })).catch(() => {});
        } catch {
            await interaction.followUp(createContainerMessage('Hata', 'Köpek bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
        }
        return;
    }
}

module.exports = { handleFunInteractions, ballAnswer, askPercent, bar, JOKES };
