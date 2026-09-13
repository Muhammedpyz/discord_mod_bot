const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

// Oto-kurulum seçimleri (kullanıcı başına)
const okSecim = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of okSecim.entries()) {
        if (now - v.t > 15 * 60 * 1000) okSecim.delete(k);
    }
}, 5 * 60 * 1000);

function okRows(s) {
    const t = (acik, ad) => new ButtonBuilder()
        .setCustomId(`ok_t_${ad}`)
        .setLabel(`${ad === 'log' ? 'Log Kanalı' : ad === 'welcome' ? 'Karşılama' : ad === 'sayac' ? 'Sayaç' : 'Doğrulama'}: ${acik ? 'AÇIK' : 'KAPALI'}`)
        .setStyle(acik ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji(acik ? MONO_EMOJIS.check : MONO_EMOJIS.cross);
    return [
        new ActionRowBuilder().addComponents(t(s.log, 'log'), t(s.welcome, 'welcome')),
        new ActionRowBuilder().addComponents(t(s.sayac, 'sayac'), t(s.verify, 'verify')),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ok_go').setLabel('Kurulumu Başlat').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.settings),
            new ButtonBuilder().setCustomId('ok_cancel').setLabel('İptal').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross)
        )
    ];
}

function ozRows() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('oz_welcome').setLabel('Hoşgeldin Mesajı').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.edit || MONO_EMOJIS.pin),
        new ButtonBuilder().setCustomId('oz_goodbye').setLabel('Ayrılış Mesajı').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.edit || MONO_EMOJIS.pin),
        new ButtonBuilder().setCustomId('oz_dm').setLabel('DM Mesajı').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.mail || MONO_EMOJIS.pin),
        new ButtonBuilder().setCustomId('oz_preview').setLabel('Önizleme').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.eye || MONO_EMOJIS.search)
    )];
}

async function handleKurulumInteractions(interaction) {
    const { customId } = interaction;

    // ===== Not defteri modal =====
    if (customId === 'not_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        const baslik = interaction.fields.getTextInputValue('baslik');
        const icerik = interaction.fields.getTextInputValue('icerik');
        await db.pool.query('INSERT INTO notlar (user_id, baslik, icerik) VALUES (?, ?, ?)', [interaction.user.id, baslik, icerik]);
        await interaction.editReply(createContainerMessage('Kaydedildi', `<:mono:${MONO_EMOJIS.check}> Notun deftere eklendi: **${baslik}**`, '#57F287', [], [], false, true)).catch(() => {});
        return;
    }

    // ===== Oto-kurulum toggle =====
    if (customId.startsWith('ok_t_')) {
        await interaction.deferUpdate().catch(() => {});
        const key = interaction.user.id;
        const s = okSecim.get(key) || { log: true, welcome: true, sayac: false, verify: false, t: Date.now() };
        const hangi = customId.split('_')[2];
        if (s[hangi] !== undefined) s[hangi] = !s[hangi];
        s.t = Date.now();
        okSecim.set(key, s);
        await interaction.editReply(createContainerMessage('Oto Kurulum', 'Kurulacak sistemleri seç, sonra başlat:', '#5865F2', okRows(s))).catch(() => {});
        return;
    }

    if (customId === 'ok_cancel') {
        await interaction.deferUpdate().catch(() => {});
        okSecim.delete(interaction.user.id);
        await interaction.editReply({ ...createContainerMessage('İptal', 'Kurulum iptal edildi.', '#FEE75C'), components: [] }).catch(() => {});
        return;
    }

    if (customId === 'ok_go') {
        await interaction.deferUpdate().catch(() => {});
        const s = okSecim.get(interaction.user.id) || { log: true, welcome: true, sayac: false, verify: false };
        okSecim.delete(interaction.user.id);
        const yapilan = [];
        try {
            const guild = interaction.guild;
            if (s.log) {
                const ch = await guild.channels.create({ name: 'bot-log', type: ChannelType.GuildText, reason: 'Oto kurulum' }).catch(() => null);
                if (ch) {
                    await db.pool.query('INSERT INTO guild_config (guild_id, log_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_channel_id=VALUES(log_channel_id)', [guild.id, ch.id]).catch(() => {});
                    yapilan.push(`Log kanalı: <#${ch.id}>`);
                }
            }
            if (s.welcome) {
                const ch = await guild.channels.create({ name: 'hoş-geldin', type: ChannelType.GuildText, reason: 'Oto kurulum' }).catch(() => null);
                if (ch) {
                    await db.pool.query('INSERT INTO welcome_config (guild_id, welcome_channel_id, goodbye_channel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE welcome_channel_id=VALUES(welcome_channel_id), goodbye_channel_id=VALUES(goodbye_channel_id)', [guild.id, ch.id, ch.id]).catch(() => {});
                    yapilan.push(`Karşılama kanalı: <#${ch.id}> (mesajları /özelleştir ile yaz)`);
                }
            }
            if (s.sayac) {
                const ch = await guild.channels.create({ name: `Uye: ${guild.memberCount}/1000`, type: ChannelType.GuildVoice, reason: 'Oto kurulum' }).catch(() => null);
                if (ch) {
                    await db.pool.query('INSERT INTO sayac_config (guild_id, channel_id, hedef) VALUES (?, ?, 1000) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id)', [guild.id, ch.id]).catch(() => {});
                    yapilan.push(`Sayaç: <#${ch.id}>`);
                }
            }
            if (s.verify) {
                const rol = await guild.roles.create({ name: 'Doğrulanmış', reason: 'Oto kurulum' }).catch(() => null);
                const ch = await guild.channels.create({ name: 'doğrulama', type: ChannelType.GuildText, reason: 'Oto kurulum' }).catch(() => null);
                if (rol && ch) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dogrula_btn').setLabel('Doğrula').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.shield)
                    );
                    const panel = createContainerMessage('Doğrulama', 'Sunucuya erişmek için butona bas ve soruyu cevapla.', '#57F287', [row]);
                    const msg = await ch.send({ ...panel, flags: MessageFlags.IsComponentsV2 }).catch(() => null);
                    await db.pool.query('INSERT INTO dogrulama_config (guild_id, channel_id, message_id, role_id, is_active) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=VALUES(message_id), role_id=VALUES(role_id), is_active=TRUE', [guild.id, ch.id, msg ? msg.id : null, rol.id]).catch(() => {});
                    yapilan.push(`Doğrulama: <#${ch.id}> + <@&${rol.id}>`);
                }
            }
        } catch (e) {
            console.error('[OtoKurulum]:', e.message);
        }
        const payload = createContainerMessage('Kurulum Tamam', yapilan.length > 0 ? yapilan.map(y => `• ${y}`).join('\n') : 'Hiçbir sistem kurulamadı (bot yetkilerini kontrol et).', yapilan.length > 0 ? '#57F287' : '#ED4245', []);
        await interaction.editReply(payload).catch(() => {});
        return;
    }

    // ===== Özelleştir butonları -> modal =====
    if (customId === 'oz_welcome' || customId === 'oz_goodbye' || customId === 'oz_dm') {
        const titles = { oz_welcome: 'Hoşgeldin Mesajı', oz_goodbye: 'Ayrılış Mesajı', oz_dm: 'DM Karşılama Mesajı' };
        const keys = { oz_welcome: 'welcome_message', oz_goodbye: 'goodbye_message', oz_dm: 'welcome_dm_message' };
        let mevcut = '';
        try {
            const rows = await db.pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [interaction.guild.id]);
            mevcut = rows[0]?.[keys[customId]] || '';
        } catch {}
        const modal = new ModalBuilder().setCustomId(`oz_modal_${customId}`).setTitle(titles[customId]);
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('metin').setLabel('Mesaj ({user} {server} {count} geçerli)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setValue(String(mevcut).slice(0, 1000))
        ));
        await interaction.showModal(modal).catch(() => {});
        return;
    }

    if (customId.startsWith('oz_modal_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        const hangi = customId.replace('oz_modal_', '');
        const keys = { oz_welcome: 'welcome_message', oz_goodbye: 'goodbye_message', oz_dm: 'welcome_dm_message' };
        const metin = interaction.fields.getTextInputValue('metin');
        try {
            await db.pool.query(`INSERT INTO welcome_config (guild_id, ${keys[hangi]}) VALUES (?, ?) ON DUPLICATE KEY UPDATE ${keys[hangi]}=VALUES(${keys[hangi]})`, [interaction.guild.id, metin]);
            try { require('../db').clearWelcomeConfigCache(interaction.guild.id); } catch {}
            await interaction.editReply(createContainerMessage('Kaydedildi', `<:mono:${MONO_EMOJIS.check}> Mesaj güncellendi:\n\n\`${metin.slice(0, 500)}\``, '#57F287', [], [], false, true)).catch(() => {});
        } catch (e) {
            console.error('[Özelleştir]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Kaydedilemedi.', '#ED4245', [], [], false, true)).catch(() => {});
        }
        return;
    }

    if (customId === 'oz_preview') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        try {
            const rows = await db.pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [interaction.guild.id]);
            const cfg = rows[0] || {};
            const ornek = (t) => String(t || '—').split('{user}').join(`<@${interaction.user.id}>`).split('{server}').join(interaction.guild.name).split('{count}').join(String(interaction.guild.memberCount)).split('{memberCount}').join(String(interaction.guild.memberCount));
            const body = `**Hoşgeldin:**\n${ornek(cfg.welcome_message)}\n\n**Ayrılış:**\n${ornek(cfg.goodbye_message)}\n\n**DM:**\n${ornek(cfg.welcome_dm_message) || 'Kapalı'}`;
            await interaction.editReply(createContainerMessage('Mesaj Önizleme', body.slice(0, 3500), '#5865F2')).catch(() => {});
        } catch (e) {
            console.error('[Önizleme]:', e.message);
        }
    }
}

module.exports = { handleKurulumInteractions, okRows, ozRows, okSecim };
