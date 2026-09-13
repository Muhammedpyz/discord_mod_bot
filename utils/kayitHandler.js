const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

// Doğrulama soru havuzu (bellek içi, kullanıcı başına)
const dogrulaSorular = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of dogrulaSorular.entries()) {
        if (now - v.t > 10 * 60 * 1000) dogrulaSorular.delete(k);
    }
}, 5 * 60 * 1000);

async function handleKayitInteractions(interaction) {
    const { customId } = interaction;

    if (customId === 'dogrula_btn') {
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM dogrulama_config WHERE guild_id = ?', [interaction.guild.id]);
            if (rows.length === 0 || !rows[0].is_active || !rows[0].role_id) {
                return interaction.reply(createContainerMessage('Bilgi', 'Doğrulama sistemi şu an kapalı.', '#FEE75C', [], [], false, true)).catch(() => {});
            }
            if (interaction.member.roles.cache.has(rows[0].role_id)) {
                return interaction.reply(createContainerMessage('Bilgi', 'Zaten doğrulanmışsın.', '#3498DB', [], [], false, true)).catch(() => {});
            }
            const a = 2 + Math.floor(Math.random() * 8);
            const b = 2 + Math.floor(Math.random() * 8);
            dogrulaSorular.set(`${interaction.guild.id}:${interaction.user.id}`, { cevap: a + b, t: Date.now() });
            const modal = new ModalBuilder().setCustomId('dogrula_modal').setTitle('Doğrulama');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('cevap').setLabel(`${a} + ${b} kaç eder?`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5)
            ));
            await interaction.showModal(modal).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    if (customId === 'dogrula_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        const key = `${interaction.guild.id}:${interaction.user.id}`;
        const soru = dogrulaSorular.get(key);
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM dogrulama_config WHERE guild_id = ?', [interaction.guild.id]);
            if (rows.length === 0 || !rows[0].role_id) {
                return interaction.editReply(createContainerMessage('Hata', 'Doğrulama yapılandırması bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            const val = parseInt(interaction.fields.getTextInputValue('cevap'), 10);
            if (!soru || val !== soru.cevap) {
                dogrulaSorular.delete(key);
                return interaction.editReply(createContainerMessage('Yanlış Cevap', 'Cevap yanlış. Butona tekrar basıp yeni soruyla dene.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            dogrulaSorular.delete(key);
            await interaction.member.roles.add(rows[0].role_id, 'Doğrulama başarılı').catch(() => {});
            // Kayıtsız rolü varsa al
            try {
                const kcfg = await conn.query('SELECT kayitsiz_role_id FROM kayit_config WHERE guild_id = ?', [interaction.guild.id]);
                if (kcfg[0]?.kayitsiz_role_id && interaction.member.roles.cache.has(kcfg[0].kayitsiz_role_id)) {
                    await interaction.member.roles.remove(kcfg[0].kayitsiz_role_id, 'Doğrulama sonrası kayıtsız alındı').catch(() => {});
                }
            } catch {}
            await interaction.editReply(createContainerMessage('Doğrulandı', `<:mono:${MONO_EMOJIS.check}> Başarıyla doğrulandın, iyi eğlenceler!`, '#57F287', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
}

/** Sayaç kanal ismini günceller: şablondaki {sayi} ve {hedef} değişir. */
async function updateSayac(guild) {
    try {
        const rows = await db.pool.query('SELECT * FROM sayac_config WHERE guild_id = ?', [guild.id]);
        if (rows.length === 0) return;
        const cfg = rows[0];
        const ch = guild.channels.cache.get(cfg.channel_id);
        if (!ch) return;
        const isim = String(cfg.sablon || 'Uye: {sayi}/{hedef}')
            .split('{sayi}').join(String(guild.memberCount))
            .split('{hedef}').join(String(cfg.hedef))
            .slice(0, 100);
        if (ch.name !== isim) await ch.setName(isim).catch(() => {});
    } catch {}
}

module.exports = { handleKayitInteractions, updateSayac };
