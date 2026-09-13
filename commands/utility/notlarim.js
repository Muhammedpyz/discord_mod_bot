const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notlarım')
        .setDescription('Kişisel not defterin (ekle/liste/sil).')
        .addSubcommand(s => s.setName('ekle').setDescription('Yeni not eklersin.'))
        .addSubcommand(s => s.setName('liste').setDescription('Notlarını listeler.'))
        .addSubcommand(s => s.setName('sil').setDescription('Not silersin.')
            .addIntegerOption(o => o.setName('id').setDescription('Not ID').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'ekle') {
            const modal = new ModalBuilder().setCustomId('not_modal').setTitle('Yeni Not');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('baslik').setLabel('Başlık').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icerik').setLabel('İçerik').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500))
            );
            await interaction.showModal(modal).catch(() => {});
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        try {
            if (sub === 'liste') {
                const rows = await db.pool.query('SELECT id, baslik, icerik FROM notlar WHERE user_id = ? ORDER BY id DESC LIMIT 10', [interaction.user.id]);
                if (rows.length === 0) {
                    return interaction.editReply(createContainerMessage('Notlarım', 'Henüz notun yok.', '#3498DB', [], [], false, true));
                }
                let list = '';
                for (const r of rows) list += `\`#${r.id}\` **${r.baslik}**\n-# ${String(r.icerik).slice(0, 100)}\n\n`;
                await interaction.editReply(createContainerMessage('Notlarım', list.trim(), '#5865F2'));
            } else {
                const id = interaction.options.getInteger('id');
                const res = await db.pool.query('DELETE FROM notlar WHERE id = ? AND user_id = ?', [id, interaction.user.id]);
                if (res.affectedRows > 0) {
                    await interaction.editReply(createContainerMessage('Silindi', `<:mono:${MONO_EMOJIS.check}> Not silindi.`, '#57F287', [], [], false, true));
                } else {
                    await interaction.editReply(createContainerMessage('Hata', 'Not bulunamadı.', '#ED4245', [], [], false, true));
                }
            }
        } catch (e) {
            console.error('[Notlar]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
