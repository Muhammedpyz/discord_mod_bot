const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const db = require('../db');

// Kısa ömürlü oyun durumları (10dk TTL süpürmeli)
const games = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, g] of games.entries()) {
        if (now - g.t > 10 * 60 * 1000) games.delete(k);
    }
}, 5 * 60 * 1000);

function gid() {
    return Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
}

async function giveCoins(guildId, userId, amount) {
    try {
        const eco = require('./globalEco');
        await eco.addBalance(userId, amount);
        try { require('./achievements').trackBalance(guildId, userId).catch(() => {}); } catch {}
        try { require('./achievements').trackOyun(guildId, userId).catch(() => {}); } catch {}
    } catch {}
}

// ---------- XOX ----------
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function xoxWinner(b) {
    for (const [a, c, d] of WIN_LINES) {
        if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return b.every(Boolean) ? 'berabere' : null;
}

function xoxBoard(id, g) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
            const i = r * 3 + c;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ox_${id}_${i}`)
                    .setLabel(g.b[i] || ' ')
                    .setStyle(g.b[i] === 'X' ? ButtonStyle.Primary : g.b[i] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setDisabled(!!g.b[i] || !!g.over)
            );
        }
        rows.push(row);
    }
    return rows;
}

function xoxText(g, pX, pO) {
    if (g.over === 'berabere') return 'Oyun berabere bitti!';
    if (g.over) {
        const w = g.over === 'X' ? pX : pO;
        return `<@${w}> kazandı!`;
    }
    const t = g.turn === 'X' ? pX : pO;
    return `Sıra: <@${t}> (${g.turn})`;
}

async function xoxRender(interaction, id) {
    const g = games.get('ox' + id);
    if (!g) return;
    const rows = xoxBoard(id, g);
    if (g.over) {
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ox_new_${id}`).setLabel('Rövanş').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
        ));
    }
    const payload = createContainerMessage('XOX', `<@${g.pX}> (X) vs <@${g.pO}> (O)\n\n${xoxText(g, g.pX, g.pO)}`, '#5865F2', rows);
    await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

// ---------- Kelime listeleri ----------
const WORDS = ['kitap','bulut','deniz','kalem','ağaç','çiçek','kelebek','bilgisayar','telefon','pencere','yıldız','güneş','orman','nehir','dağ','tren','uçak','gemi','kedi','köpek','kuş','balık','elma','armut','kiraz','portakal','ekmek','peynir','zeytin','domates','biber','soğan','sarımsak','patates','havuç','marul','ıspanak','lahana','turp','mantık','cesaret','özgürlük','barış','sevgi','saygı','dostluk','mutluluk','hüzün','korku','umut','rüya','gerçek','hayal','zaman','mekan','ışık','karanlık','sessizlik'];

function pickWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function scramble(w) {
    const a = [...w];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    const s = a.join('');
    return s === w ? scramble(w) : s;
}

// ---------- Trivia / Dilemma verileri ----------
const TRIVIA = [
    { s: 'Türkiye\'nin başkenti neresidir?', o: ['İstanbul', 'Ankara', 'İzmir', 'Bursa'], d: 1 },
    { s: 'İstiklal Marşı şairi kimdir?', o: ['Nazım Hikmet', 'Mehmet Akif Ersoy', 'Yahya Kemal', 'Necip Fazıl'], d: 1 },
    { s: 'Hangi gezegen Güneş\'e en yakındır?', o: ['Venüs', 'Mars', 'Merkür', 'Jüpiter'], d: 2 },
    { s: 'Suyun kimyasal formülü nedir?', o: ['CO2', 'H2O', 'O2', 'NaCl'], d: 1 },
    { s: 'Cumhuriyet hangi yılda ilan edildi?', o: ['1920', '1921', '1922', '1923'], d: 3 },
    { s: 'En büyük okyanus hangisidir?', o: ['Atlas', 'Hint', 'Pasifik', 'Arktik'], d: 2 },
    { s: 'Hangi organ kanı pompalar?', o: ['Akciğer', 'Kalp', 'Karaciğer', 'Böbrek'], d: 1 },
    { s: 'Türk bayrağındaki yıldız kaç köşelidir?', o: ['4', '5', '6', '8'], d: 1 },
    { s: 'Işığın hızı saniyede yaklaşık kaç km\'dir?', o: ['300 bin', '150 bin', '1 milyon', '30 bin'], d: 0 },
    { s: 'Hangi yıl İstanbul fethedildi?', o: ['1453', '1444', '1461', '1439'], d: 0 },
    { s: 'DNA\'nın açılımı nedir?', o: ['Deoksiribo Nükleik Asit', 'Dinamik Nötr Asit', 'Deri Nükleik Asit', 'Deoksi Nitrik Asit'], d: 0 },
    { s: 'Satrançta kaç kare vardır?', o: ['32', '48', '64', '81'], d: 2 }
];

const BUMU = [
    ['Sonsuz para mı', 'sonsuz zaman mı'], ['Uçabilmek mi', 'görünmez olmak mı'],
    ['Geçmişe gitmek mi', 'geleceğe gitmek mi'], ['Zihin okumak mı', 'geleceği görmek mi'],
    ['Hiç uyumamak mı', 'hiç yemek yememek mi'], ['Ünlü olmak mı', 'zengin olmak mı'],
    ['Denizde yaşamak mı', 'uzayda yaşamak mı'], ['Süper güç mü', 'süper zeka mı']
];

const BASAR = [
    'Kırmızı butona basar mıydın? (Bilinmeyene yolculuk)',
    'Zamanı 1 saat geri alan butona basar mıydın?',
    'Herkesin düşüncesini duyan butona basar mıydın?',
    '1 milyon Jeton ama 1 hafta sessizlik butonuna basar mıydın?',
    'Geçmişteki bir günü tekrar yaşayan butona basar mıydın?',
    'Yarınki piyango numaralarını gösteren butona basar mıydın?'
];

// oy verileri: key -> {a:Set, b:Set}
const votes = new Map();
function voteGet(key) {
    if (!votes.has(key)) votes.set(key, { a: new Set(), b: new Set() });
    return votes.get(key);
}

// ---------- Ana router ----------
async function handleGameInteractions(interaction) {
    const { customId } = interaction;

    // ===== XOX hamle =====
    if (/^ox_[a-z0-9]+_\d$/.test(customId)) {
        await interaction.deferUpdate().catch(() => {});
        const [, id, cellStr] = customId.split('_');
        const g = games.get('ox' + id);
        if (!g || g.over) return;
        const cell = parseInt(cellStr, 10);
        const me = interaction.user.id;
        const myMark = me === g.pX ? 'X' : me === g.pO ? 'O' : null;
        if (!myMark) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyunun oyuncusu değilsin.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        if (myMark !== g.turn || g.b[cell]) return;
        g.b[cell] = myMark;
        const w = xoxWinner(g.b);
        if (w) {
            g.over = w;
            if (w !== 'berabere') {
                const winnerId = w === 'X' ? g.pX : g.pO;
                giveCoins(interaction.guild.id, winnerId, 50);
                // Zafer GIF'li final kartı
                const { funCard: fcXox } = require('./gifHandler');
                const rows = [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ox_new_${id}`).setLabel('Rövanş').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
                )];
                const payload = await fcXox('XOX', [`<@${g.pX}> (X) vs <@${g.pO}> (O)`, '', `<@${winnerId}> kazandı! **+50** Jeton`], rows, 'winner celebration');
                await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                return;
            }
        } else {
            g.turn = g.turn === 'X' ? 'O' : 'X';
        }
        await xoxRender(interaction, id);
        return;
    }

    if (customId.startsWith('ox_new_')) {
        await interaction.deferUpdate().catch(() => {});
        const oldId = customId.split('_')[2];
        const old = games.get('ox' + oldId);
        if (!old) return;
        if (interaction.user.id !== old.pX && interaction.user.id !== old.pO) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Rövanşı sadece oyuncular başlatabilir.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const id = gid();
        games.set('ox' + id, { b: Array(9).fill(null), pX: old.pO, pO: old.pX, turn: 'X', over: null, t: Date.now() });
        games.delete('ox' + oldId);
        const g = games.get('ox' + id);
        const payload = createContainerMessage('XOX', `<@${g.pX}> (X) vs <@${g.pO}> (O)\n\nSıra: <@${g.pX}> (X)`, '#5865F2', xoxBoard(id, g));
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Sayı tahmin: buton -> modal =====
    if (customId.startsWith('sayi_btn_')) {
        const id = customId.split('_')[2];
        const g = games.get('sayi' + id);
        if (!g) {
            return interaction.reply(createContainerMessage('Bilgi', 'Bu oyun süresi dolmuş. Yeni oyun başlat.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const { ModalBuilder: MB, TextInputBuilder: TB, TextInputStyle: TS, ActionRowBuilder: AR } = require('discord.js');
        const modal = new MB().setCustomId(`sayi_modal_${id}`).setTitle('Tahminini Yaz');
        modal.addComponents(new AR().addComponents(
            new TB().setCustomId('tahmin').setLabel(`1-${g.max} arası sayı`).setStyle(TS.Short).setRequired(true).setMaxLength(6)
        ));
        await interaction.showModal(modal).catch(() => {});
        return;
    }

    if (customId.startsWith('sayi_modal_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('sayi' + id);
        if (!g) return;
        if (interaction.user.id !== g.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyun senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const val = parseInt(interaction.fields.getTextInputValue('tahmin'), 10);
        if (isNaN(val)) {
            return interaction.followUp(createContainerMessage('Hata', 'Geçerli bir sayı yazmalısın.', '#ED4245', [], [], false, true)).catch(() => {});
        }
        g.deneme++;
        if (val === g.num) {
            const odul = Math.max(10, 60 - g.deneme * 5);
            giveCoins(interaction.guild.id, g.user, odul);
            games.delete('sayi' + id);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sayi_new_${g.max}`).setLabel('Yeni Oyun').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Sayı Tahmin', `Doğru! Sayı **${g.num}** idi.\n${g.deneme}. denemede buldun, **${odul}** Jeton kazandın!`, '#57F287', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        if (g.deneme >= 10) {
            games.delete('sayi' + id);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sayi_new_${g.max}`).setLabel('Yeni Oyun').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Sayı Tahmin', `Hakkın bitti! Sayı **${g.num}** idi.`, '#ED4245', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        const hint = val < g.num ? 'Daha büyük bir sayı dene.' : 'Daha küçük bir sayı dene.';
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`sayi_btn_${id}`).setLabel('Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.target || MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Sayı Tahmin', `**${val}** — ${hint}\n\n-# Deneme: ${g.deneme}/10`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    if (customId.startsWith('sayi_new_')) {
        await interaction.deferUpdate().catch(() => {});
        const max = Math.max(10, Math.min(1000, parseInt(customId.split('_')[2], 10) || 100));
        const id = gid();
        games.set('sayi' + id, { num: 1 + Math.floor(Math.random() * max), max, deneme: 0, user: interaction.user.id, t: Date.now() });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`sayi_btn_${id}`).setLabel('Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Sayı Tahmin', `1-${max} arası bir sayı tuttum. 10 hakkın var!`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Kelime oyunu =====
    if (customId.startsWith('kelime_btn_')) {
        const id = customId.split('_')[2];
        const g = games.get('kelime' + id);
        if (!g) {
            return interaction.reply(createContainerMessage('Bilgi', 'Bu oyun süresi dolmuş.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const modal = new ModalBuilder().setCustomId(`kelime_modal_${id}`).setTitle('Kelime Tahmini');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('kelime').setLabel('Kelime nedir?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)
        ));
        await interaction.showModal(modal).catch(() => {});
        return;
    }

    if (customId.startsWith('kelime_modal_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('kelime' + id);
        if (!g) return;
        if (interaction.user.id !== g.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyun senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const val = interaction.fields.getTextInputValue('kelime').toLocaleLowerCase('tr-TR').trim();
        g.deneme++;
        if (val === g.word) {
            const odul = g.word.length * 10;
            giveCoins(interaction.guild.id, g.user, odul);
            games.delete('kelime' + id);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kelime_new').setLabel('Yeni Kelime').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Kelime Oyunu', `Doğru! Kelime **${g.word}** idi.\n**${odul}** Jeton kazandın!`, '#57F287', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        if (g.deneme >= 5) {
            games.delete('kelime' + id);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kelime_new').setLabel('Yeni Kelime').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Kelime Oyunu', `Hakkın bitti! Kelime **${g.word}** idi.`, '#ED4245', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kelime_btn_${id}`).setLabel('Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Kelime Oyunu', `Karışık harfler: **${g.scrambled}**\n\nYanlış! İpucu: ilk harf **${g.word[0].toUpperCase()}**, ${g.word.length} harf.\n\n-# Deneme: ${g.deneme}/5`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    if (customId === 'kelime_new') {
        await interaction.deferUpdate().catch(() => {});
        const { pickWord: pw, scramble: sc } = require('./gameWords');
        const word = pw();
        const id = gid();
        games.set('kelime' + id, { word, scrambled: sc(word), deneme: 0, user: interaction.user.id, t: Date.now() });
        const g = games.get('kelime' + id);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kelime_btn_${id}`).setLabel('Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Kelime Oyunu', `Karışık harfler: **${g.scrambled}**\n\n-# 5 hakkın var`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Adam asmaca =====
    if (customId.startsWith('asmaca_btn_')) {
        const id = customId.split('_')[2];
        if (!games.get('asmaca' + id)) {
            return interaction.reply(createContainerMessage('Bilgi', 'Bu oyun süresi dolmuş.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const modal = new ModalBuilder().setCustomId(`asmaca_modal_${id}`).setTitle('Harf Tahmini');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('harf').setLabel('Bir harf yaz').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(2)
        ));
        await interaction.showModal(modal).catch(() => {});
        return;
    }

    if (customId.startsWith('asmaca_modal_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('asmaca' + id);
        if (!g) return;
        if (interaction.user.id !== g.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyun senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const harf = interaction.fields.getTextInputValue('harf').toLocaleLowerCase('tr-TR').trim()[0];
        if (g.tahmin.includes(harf)) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu harfi zaten denedin.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        g.tahmin.push(harf);
        const mask = [...g.word].map(c => (g.tahmin.includes(c) ? c : '_')).join(' ');
        if (![...g.word].some(c => !g.tahmin.includes(c))) {
            const odul = g.word.length * 12;
            giveCoins(interaction.guild.id, g.user, odul);
            games.delete('asmaca' + id);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('asmaca_new').setLabel('Yeni Oyun').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Adam Asmaca', `Kazandın! Kelime: **${g.word}**\n**${odul}** Jeton kazandın!`, '#57F287', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        if (!g.word.includes(harf)) g.hak--;
        if (g.hak <= 0) {
            games.delete('asmaca' + id);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('asmaca_new').setLabel('Yeni Oyun').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Adam Asmaca', `Kaybettin! Kelime: **${g.word}** idi.`, '#ED4245', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`asmaca_btn_${id}`).setLabel('Harf Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Adam Asmaca', `Kelime: **${mask}**\nKalan hak: **${g.hak}**\nDenenen: ${g.tahmin.join(', ')}`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    if (customId === 'asmaca_new') {
        await interaction.deferUpdate().catch(() => {});
        const { pickWord: pw2 } = require('./gameWords');
        const word = pw2().toLocaleLowerCase('tr-TR');
        const id = gid();
        games.set('asmaca' + id, { word, tahmin: [], hak: 6, user: interaction.user.id, t: Date.now() });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`asmaca_btn_${id}`).setLabel('Harf Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Adam Asmaca', `Kelime: **${[...word].map(() => '_').join(' ')}**\nKalan hak: **6**`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Düello =====
    if (customId.startsWith('duello_atk_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('duello' + id);
        if (!g || g.over) return;
        const me = interaction.user.id;
        if (me !== g.turn) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Sıra sende değil!', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const crit = Math.random() < 0.12;
        const dmg = Math.floor(8 + Math.random() * 13) * (crit ? 2 : 1);
        const foe = me === g.p1 ? 'hp1' in g && g.p1 === me ? 'hp2' : 'hp2' : 'hp1';
        g[foe] = Math.max(0, g[foe] - dmg);
        g.log.unshift(`${me === g.p1 ? '1. oyuncu' : '2. oyuncu'} ${dmg} vurdu${crit ? ' (KRİTİK!)' : ''}`);
        g.log = g.log.slice(0, 3);
        const foeId = me === g.p1 ? g.p2 : g.p1;
        if (g[foe] <= 0) {
            g.over = me;
            giveCoins(interaction.guild.id, me, 75);
            const { funCard: fcDuel } = require('./gifHandler');
            const payload = await fcDuel('Düello', [`<@${g.p1}> vs <@${g.p2}>`, '', `<@${me}> kazandı! **75** Jeton ödül!`, '', `-# ${g.log.join(' | ')}`], [], 'victory celebration');
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        g.turn = foeId;
        await duelloRender(interaction, id, g);
        return;
    }

    if (customId.startsWith('duello_pes_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('duello' + id);
        if (!g || g.over) return;
        const me = interaction.user.id;
        if (me !== g.p1 && me !== g.p2) return;
        const winner = me === g.p1 ? g.p2 : g.p1;
        g.over = winner;
        giveCoins(interaction.guild.id, winner, 50);
        const payload = createContainerMessage('Düello', `<@${g.p1}> vs <@${g.p2}>\n\n<@${me}> pes etti! <@${winner}> kazandı (**50** Jeton).`, '#FEE75C', []);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Zar düello =====
    if (customId.startsWith('zard_at_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('zard' + id);
        if (!g || g.over) return;
        const me = interaction.user.id;
        if (me !== g.p1 && me !== g.p2) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu düellonun oyuncusu değilsin.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        if ((me === g.p1 && g.r1 !== null) || (me === g.p2 && g.r2 !== null)) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Zarını zaten attın, rakibi bekle.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const roll = 1 + Math.floor(Math.random() * 6);
        if (me === g.p1) g.r1 = roll; else g.r2 = roll;
        if (g.r1 !== null && g.r2 !== null) {
            if (g.r1 === g.r2) {
                g.r1 = null; g.r2 = null;
                const payload = createContainerMessage('Zar Düello', `<@${g.p1}> vs <@${g.p2}>\n\nBerabere! Tekrar zar atın.`, '#FEE75C', zardRows(id));
                await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                return;
            }
            g.over = true;
            const winner = g.r1 > g.r2 ? g.p1 : g.p2;
            giveCoins(interaction.guild.id, winner, 50);
            const { funCard: fcZard } = require('./gifHandler');
            const payload = await fcZard('Zar Düello', [`<@${g.p1}>: **${g.r1}**`, `<@${g.p2}>: **${g.r2}**`, '', `<@${winner}> kazandı! **50** Jeton!`], [], 'champion');
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        const payload = createContainerMessage('Zar Düello', `<@${g.p1}> vs <@${g.p2}>\n\n${me === g.p1 ? `<@${g.p1}> attı, <@${g.p2}> bekleniyor...` : `<@${g.p2}> attı, <@${g.p1}> bekleniyor...`}`, '#5865F2', zardRows(id));
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Taş Kağıt Makas (bota karşı, 3 tur) =====
    if (customId.startsWith('tkm_')) {
        await interaction.deferUpdate().catch(() => {});
        const parts = customId.split('_');
        if (parts[1] === 'new') {
            const id = gid();
            games.set('tkm' + id, { user: interaction.user.id, tur: 0, ben: 0, bot: 0, t: Date.now() });
            await interaction.message.edit({ ...tkmCard(id, games.get('tkm' + id)), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        const secim = parseInt(parts[1], 10);
        const id = parts[2];
        const g = games.get('tkm' + id);
        if (!g || g.over) return;
        if (interaction.user.id !== g.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyun senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const botSec = Math.floor(Math.random() * 3);
        const ad = ['Taş', 'Kağıt', 'Makas'];
        const fark = (secim - botSec + 3) % 3;
        g.tur++;
        if (fark === 1) g.ben++;
        else if (fark === 2) g.bot++;
        g.son = `Sen: ${ad[secim]} — Bot: ${ad[botSec]} → ${fark === 0 ? 'Berabere' : fark === 1 ? 'Kazandın' : 'Kaybettin'}`;
        if (g.tur >= 3) {
            g.over = true;
            if (g.ben > g.bot) giveCoins(interaction.guild.id, g.user, 25);
            const sonuc = g.ben > g.bot ? `Kazandın! +25 Jeton` : g.ben === g.bot ? 'Berabere!' : 'Kaybettin!';
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkm_new').setLabel('Tekrar Oyna').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const { funCard: fcTkm } = require('./gifHandler');
            const payload = await fcTkm('Taş Kağıt Makas', [`${g.son}`, '', `Skor: Sen **${g.ben}** — Bot **${g.bot}**`, '', `**${sonuc}**`], [row], g.ben > g.bot ? 'winner' : null);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        await interaction.message.edit({ ...tkmCard(id, g), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Hızlı yaz (modal) =====
    if (customId.startsWith('hizyaz_btn_')) {
        const id = customId.split('_')[2];
        if (!games.get('hizyaz' + id)) {
            return interaction.reply(createContainerMessage('Bilgi', 'Bu oyun süresi dolmuş.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const modal = new ModalBuilder().setCustomId(`hizyaz_modal_${id}`).setTitle('Kelimeyi Aynen Yaz');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('yazi').setLabel('Kelime').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)
        ));
        await interaction.showModal(modal).catch(() => {});
        return;
    }

    if (customId.startsWith('hizyaz_modal_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = games.get('hizyaz' + id);
        if (!g) return;
        if (interaction.user.id !== g.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyun senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        const val = interaction.fields.getTextInputValue('yazi').trim();
        games.delete('hizyaz' + id);
        const sure = (Date.now() - g.t0) / 1000;
        if (val === g.word) {
            const odul = sure < 5 ? 75 : sure < 10 ? 50 : sure < 20 ? 25 : 10;
            giveCoins(interaction.guild.id, g.user, odul);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hizyaz_new').setLabel('Yeni Kelime').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Hızlı Yaz', `Doğru! **${sure.toFixed(1)}** saniyede yazdın.\n**+${odul}** Jeton!`, '#57F287', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        } else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hizyaz_new').setLabel('Yeni Kelime').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Hızlı Yaz', `Yanlış! Doğrusu **${g.word}** idi.`, '#ED4245', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
        return;
    }

    if (customId === 'hizyaz_new') {
        await interaction.deferUpdate().catch(() => {});
        const { pickWord: pw3 } = require('./gameWords');
        const word = pw3();
        const id = gid();
        games.set('hizyaz' + id, { word, user: interaction.user.id, t0: Date.now(), t: Date.now() });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hizyaz_btn_${id}`).setLabel('Yazmaya Başla').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        const payload = createContainerMessage('Hızlı Yaz', `Kelime: **${word}**\n\nButona bas, aynısını hızlıca yaz!`, '#5865F2', [row]);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return;
    }

    // ===== Bilgi yarışması (durumsuz) =====
    if (customId.startsWith('trivia_')) {
        await interaction.deferUpdate().catch(() => {});
        const parts = customId.split('_');
        if (parts[1] === 'new') {
            const qi = Math.floor(Math.random() * TRIVIA.length);
            await interaction.message.edit({ ...triviaCard(qi), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return;
        }
        const qi = parseInt(parts[1], 10);
        const oi = parseInt(parts[2], 10);
        const q = TRIVIA[qi];
        if (!q) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trivia_new').setLabel('Yeni Soru').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.refresh)
        );
        if (oi === q.d) {
            giveCoins(interaction.guild.id, interaction.user.id, 40);
            const { funCard: fcTrv } = require('./gifHandler');
            const payload = await fcTrv('Bilgi Yarışması', [`**${q.s}**`, '', `Doğru! Cevap: **${q.o[q.d]}**`, `**+40** Jeton kazandın!`], [row], 'celebration');
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        } else {
            const payload = createContainerMessage('Bilgi Yarışması', `**${q.s}**\n\nYanlış! Doğru cevap: **${q.o[q.d]}**`, '#ED4245', [row]);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
        return;
    }

    // ===== Bunu mu şunu mu (oylama) =====
    if (customId.startsWith('bumu_') || customId.startsWith('basar_')) {
        await interaction.deferUpdate().catch(() => {});
        const isBumu = customId.startsWith('bumu_');
        const parts = customId.split('_');
        const taraf = parts[1];
        const di = parseInt(parts[2], 10);
        const key = (isBumu ? 'bumu' : 'basar') + di;
        const v = voteGet(key);
        v.a.delete(interaction.user.id);
        v.b.delete(interaction.user.id);
        (taraf === 'a' ? v.a : v.b).add(interaction.user.id);
        const total = v.a.size + v.b.size || 1;
        const pa = Math.round((v.a.size / total) * 100);
        if (isBumu) {
            const d = BUMU[di] || BUMU[0];
            const payload = createContainerMessage('Bunu mu Şunu mu', `**${d[0]}**\n\`${bar2(pa)}\` %${pa} (${v.a.size} oy)\n\n**${d[1]}**\n\`${bar2(100 - pa)}\` %${100 - pa} (${v.b.size} oy)`, '#5865F2', bumuRows(di));
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        } else {
            const d = BASAR[di] || BASAR[0];
            const payload = createContainerMessage('Basar mıydın', `**${d}**\n\n**Basardım:** \`${bar2(pa)}\` %${pa} (${v.a.size})\n**Basmazdım:** \`${bar2(100 - pa)}\` %${100 - pa} (${v.b.size})`, '#5865F2', basarRows(di));
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }
}

function bar2(p) {
    const f = Math.round(Math.max(0, Math.min(100, p)) / 10);
    return '█'.repeat(f) + '░'.repeat(10 - f);
}

function tkmCard(id, g) {
    const ad = ['Taş', 'Kağıt', 'Makas'];
    const row = new ActionRowBuilder().addComponents(
        ad.map((a, i) => new ButtonBuilder().setCustomId(`tkm_${i}_${id}`).setLabel(a).setStyle(ButtonStyle.Secondary))
    );
    return createContainerMessage('Taş Kağıt Makas', `Tur: **${g.tur + 1}/3** • Skor: Sen **${g.ben}** — Bot **${g.bot}**\n${g.son ? `\n-# Son: ${g.son}` : ''}`, '#5865F2', [row]);
}

function triviaCard(qi) {
    const q = TRIVIA[qi];
    const rows = [];
    let row = new ActionRowBuilder();
    q.o.forEach((opt, i) => {
        row.addComponents(new ButtonBuilder().setCustomId(`trivia_${qi}_${i}`).setLabel(opt.slice(0, 80)).setStyle(ButtonStyle.Secondary));
        if (row.components.length === 2) { rows.push(row); row = new ActionRowBuilder(); }
    });
    if (row.components.length > 0) rows.push(row);
    return createContainerMessage('Bilgi Yarışması', `**${q.s}**\n\n-# Doğru cevap +40 Jeton`, '#5865F2', rows);
}

function bumuRows(di) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bumu_a_${di}`).setLabel('Birinci').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bumu_b_${di}`).setLabel('İkinci').setStyle(ButtonStyle.Danger)
    )];
}

function basarRows(di) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`basar_a_${di}`).setLabel('Basardım').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check),
        new ButtonBuilder().setCustomId(`basar_b_${di}`).setLabel('Basmazdım').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross)
    )];
}

function hpBar(hp) {
    const f = Math.round(hp / 10);
    return '█'.repeat(f) + '░'.repeat(10 - f);
}

async function duelloRender(interaction, id, g) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duello_atk_${id}`).setLabel('Saldır').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.swords),
        new ButtonBuilder().setCustomId(`duello_pes_${id}`).setLabel('Pes Et').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.flag || MONO_EMOJIS.cross)
    );
    const payload = createContainerMessage(
        'Düello',
        `<@${g.p1}>: \`${hpBar(g.hp1)}\` ${g.hp1}\n<@${g.p2}>: \`${hpBar(g.hp2)}\` ${g.hp2}\n\nSıra: <@${g.turn}>\n\n-# ${g.log.join('\n') || 'Herkes hazır!'}`,
        '#5865F2', [row]
    );
    await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

function zardRows(id) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`zard_at_${id}`).setLabel('Zarını At').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.dice_6 || MONO_EMOJIS.pin)
    )];
}

module.exports = { handleGameInteractions, games, gid, xoxBoard, xoxText, duelloRender, zardRows, tkmCard, triviaCard, bumuRows, basarRows, TRIVIA, BUMU, BASAR, votes, voteGet };
