const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { renderEtkinlik } = require('../../utils/toplulukHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('etkinlik')
        .setDescription('Etkinlik oluştur, listele, iptal et.')
        .addSubcommand(s => s.setName('olustur').setDescription('Yeni etkinlik kartı yayınlar.'))
        .addSubcommand(s => s.setName('liste').setDescription('Açık etkinlikleri listeler.'))
        .addSubcommand(s => s.setName('iptal').setDescription('Etkinliği iptal eder.')
            .addIntegerOption(o => o.setName('id').setDescription('Etkinlik ID').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'olustur') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return interaction.reply(createContainerMessage('Yetki Yok', 'Etkinlik oluşturmak için Etkinlikleri Yönet yetkisi lazım.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            const modal = new ModalBuilder().setCustomId('etk_modal').setTitle('Yeni Etkinlik');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('baslik').setLabel('Başlık').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aciklama').setLabel('Açıklama').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zaman').setLabel('Zaman (örn: 20 Eylül 21:00)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100))
            );
            await interaction.showModal(modal).catch(() => {});
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        let conn;
        try {
            conn = await db.pool.getConnection();
            if (sub === 'liste') {
                const rows = await conn.query("SELECT * FROM etkinlikler WHERE guild_id = ? AND status='acik' ORDER BY id DESC LIMIT 10", [interaction.guild.id]);
                if (rows.length === 0) {
                    return interaction.editReply(createContainerMessage('Etkinlikler', 'Açık etkinlik yok.', '#3498DB', [], [], false, true));
                }
                let list = '';
                for (const e of rows) list += `\`#${e.id}\` **${e.baslik}** — ${e.zaman || 'tarihsiz'}\n`;
                await interaction.editReply(createContainerMessage('Açık Etkinlikler', list, '#5865F2'));
            } else {
                const id = interaction.options.getInteger('id');
                const rows = await conn.query('SELECT * FROM etkinlikler WHERE id = ? AND guild_id = ?', [id, interaction.guild.id]);
                if (rows.length === 0) {
                    return interaction.editReply(createContainerMessage('Hata', 'Etkinlik bulunamadı.', '#ED4245', [], [], false, true));
                }
                const ok = rows[0].olusturan === interaction.user.id || interaction.member.permissions.has(PermissionFlagsBits.ManageEvents);
                if (!ok) {
                    return interaction.editReply(createContainerMessage('Yetki Yok', 'Sadece oluşturan veya yetkililer iptal edebilir.', '#ED4245', [], [], false, true));
                }
                await conn.query("UPDATE etkinlikler SET status='iptal' WHERE id = ?", [id]);
                await renderEtkinlik(interaction.client, id);
                await interaction.editReply(createContainerMessage('İptal', `<:mono:${MONO_EMOJIS.check}> Etkinlik iptal edildi, kart güncellendi.`, '#57F287', [], [], false, true));
            }
        } finally {
            if (conn) conn.release();
        }
    }
};
