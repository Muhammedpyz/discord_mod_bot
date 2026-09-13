const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

function etkRows(id, closed) {
    if (closed) return [];
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`etk_evet_${id}`).setLabel('Katılıyorum').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check),
        new ButtonBuilder().setCustomId(`etk_belki_${id}`).setLabel('Belki').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.clock),
        new ButtonBuilder().setCustomId(`etk_hayir_${id}`).setLabel('Katılmıyorum').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross),
        new ButtonBuilder().setCustomId(`etk_kapat_${id}`).setLabel('Kapat').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.lock)
    )];
}

async function renderEtkinlik(client, id) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const rows = await conn.query('SELECT * FROM etkinlikler WHERE id = ?', [id]);
        if (rows.length === 0) return;
        const e = rows[0];
        const kat = await conn.query("SELECT durum, COUNT(*) as c FROM etkinlik_katilim WHERE etkinlik_id = ? GROUP BY durum", [id]);
        let evet = 0, hayir = 0, belki = 0;
        for (const k of kat) {
            if (k.durum === 'evet') evet = Number(k.c);
            if (k.durum === 'hayir') hayir = Number(k.c);
            if (k.durum === 'belki') belki = Number(k.c);
        }
        const guild = client.guilds.cache.get(e.guild_id);
        if (!guild) return;
        const ch = guild.channels.cache.get(e.channel_id);
        if (!ch || !ch.isTextBased()) return;
        const msg = await ch.messages.fetch(e.message_id).catch(() => null);
        if (!msg) return;
        const closed = e.status !== 'acik';
        const body = `${e.aciklama || ''}\n\n**Zaman:** ${e.zaman || 'Belirtilmedi'}\n\n**Katılıyorum:** ${evet} • **Belki:** ${belki} • **Katılmıyorum:** ${hayir}${closed ? '\n\n-# Etkinlik kapatıldı.' : ''}`;
        const payload = createContainerMessage(e.baslik, body, closed ? '#2B2D31' : '#5865F2', etkRows(id, closed));
        await msg.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    } finally {
        if (conn) conn.release();
    }
}

async function handleToplulukInteractions(interaction) {
    const { customId } = interaction;

    // ===== Etkinlik oluşturma (modal) =====
    if (customId === 'etk_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        const baslik = interaction.fields.getTextInputValue('baslik');
        let aciklama = '';
        let zaman = '';
        try { aciklama = interaction.fields.getTextInputValue('aciklama'); } catch {}
        try { zaman = interaction.fields.getTextInputValue('zaman'); } catch {}
        let conn;
        try {
            conn = await db.pool.getConnection();
            const res = await conn.query('INSERT INTO etkinlikler (guild_id, channel_id, baslik, aciklama, zaman, olusturan) VALUES (?, ?, ?, ?, ?, ?)', [interaction.guild.id, interaction.channel.id, baslik, aciklama || null, zaman || null, interaction.user.id]);
            const id = Number(res.insertId);
            const payload = createContainerMessage(baslik, `${aciklama || ''}\n\n**Zaman:** ${zaman || 'Belirtilmedi'}\n\n**Katılıyorum:** 0 • **Belki:** 0 • **Katılmıyorum:** 0`, '#5865F2', etkRows(id, false));
            const msg = await interaction.channel.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
            await conn.query('UPDATE etkinlikler SET message_id = ? WHERE id = ?', [msg.id, id]);
            await interaction.editReply(createContainerMessage('Yayınlandı', `<:mono:${MONO_EMOJIS.check}> Etkinlik kartı yayınlandı! Katılımlar aynı kartta toplanır.`, '#57F287', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // ===== Etkinlik katılımı =====
    if (/^etk_(evet|hayir|belki|kapat)_\d+$/.test(customId)) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        const [, secim, idStr] = customId.split('_');
        const id = parseInt(idStr, 10);
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM etkinlikler WHERE id = ?', [id]);
            if (rows.length === 0) {
                return interaction.editReply(createContainerMessage('Hata', 'Etkinlik bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            const e = rows[0];
            if (e.status !== 'acik') {
                return interaction.editReply(createContainerMessage('Bilgi', 'Bu etkinlik kapatılmış.', '#FEE75C', [], [], false, true)).catch(() => {});
            }
            if (secim === 'kapat') {
                const ok = e.olusturan === interaction.user.id || interaction.member.permissions.has('ManageEvents');
                if (!ok) {
                    return interaction.editReply(createContainerMessage('Yetki Yok', 'Sadece oluşturan veya yetkililer kapatabilir.', '#ED4245', [], [], false, true)).catch(() => {});
                }
                await conn.query("UPDATE etkinlikler SET status='kapali' WHERE id = ?", [id]);
                await renderEtkinlik(interaction.client, id);
                return interaction.editReply(createContainerMessage('Kapatıldı', 'Etkinlik kapatıldı, kart güncellendi.', '#57F287', [], [], false, true)).catch(() => {});
            }
            await conn.query('INSERT INTO etkinlik_katilim (etkinlik_id, user_id, durum) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE durum=VALUES(durum)', [id, interaction.user.id, secim]);
            await renderEtkinlik(interaction.client, id);
            const ad = secim === 'evet' ? 'Katılıyorum' : secim === 'belki' ? 'Belki' : 'Katılmıyorum';
            await interaction.editReply(createContainerMessage('Kaydedildi', `Tercihin **${ad}** olarak işlendi, kart güncellendi.`, '#57F287', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // ===== Kurallar kabul =====
    if (customId === 'kural_kabul') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        try {
            const rows = await db.pool.query('SELECT rol_id FROM kurallar_config WHERE guild_id = ?', [interaction.guild.id]);
            const rolId = rows[0]?.rol_id;
            if (!rolId) {
                return interaction.editReply(createContainerMessage('Bilgi', 'Kuralları okudun, teşekkürler!', '#57F287', [], [], false, true)).catch(() => {});
            }
            if (interaction.member.roles.cache.has(rolId)) {
                return interaction.editReply(createContainerMessage('Bilgi', 'Kuralları zaten kabul etmişsin.', '#3498DB', [], [], false, true)).catch(() => {});
            }
            await interaction.member.roles.add(rolId, 'Kuralları kabul etti').catch(() => {});
            await interaction.editReply(createContainerMessage('Kabul Edildi', `<:mono:${MONO_EMOJIS.check}> Kuralları kabul ettin, iyi eğlenceler!`, '#57F287', [], [], false, true)).catch(() => {});
        } catch (e) {
            console.error('[Kural kabul]:', e.message);
        }
        return;
    }

    // ===== Oy ödülü al =====
    if (customId === 'oy_al') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        try {
            const cfg = await db.pool.query('SELECT * FROM oy_config WHERE guild_id = ?', [interaction.guild.id]);
            const odul = Number(cfg[0]?.odul || 200);
            const rows = await db.pool.query('SELECT last_claim FROM oy_odul WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
            const last = rows[0] ? Number(rows[0].last_claim) : 0;
            if (Date.now() - last < 12 * 60 * 60 * 1000) {
                const kalan = Math.ceil((12 * 60 * 60 * 1000 - (Date.now() - last)) / 3600000);
                return interaction.editReply(createContainerMessage('Bekle', `Ödülünü zaten aldın. **${kalan} saat** sonra tekrar gel.`, '#FEE75C', [], [], false, true)).catch(() => {});
            }
            await db.pool.query('INSERT INTO oy_odul (guild_id, user_id, last_claim) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_claim=VALUES(last_claim)', [interaction.guild.id, interaction.user.id, Date.now()]);
            await require('./globalEco').addBalance(interaction.user.id, odul);
            await interaction.editReply(createContainerMessage('Teşekkürler', `<:mono:${MONO_EMOJIS.check}> Oyun için **${odul}** Jeton hesabına eklendi!`, '#57F287', [], [], false, true)).catch(() => {});
        } catch (e) {
            console.error('[Oy al]:', e.message);
        }
    }
}

module.exports = { handleToplulukInteractions, renderEtkinlik, etkRows };
