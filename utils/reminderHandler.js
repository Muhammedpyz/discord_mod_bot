const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

function reminderButtons(id) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rem_done_${id}`).setLabel('Tamamlandı').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check),
        new ButtonBuilder().setCustomId(`rem_snooze_${id}`).setLabel('10dk Ertele').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.clock),
        new ButtonBuilder().setCustomId(`rem_del_${id}`).setLabel('Sil').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete)
    )];
}

async function handleReminderInteractions(interaction) {
    const { customId } = interaction;
    const id = customId.split('_')[2];

    if (customId.startsWith('rem_done_')) {
        await interaction.deferUpdate().catch(() => {});
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [id, interaction.user.id]);
            if (rows.length === 0) {
                return interaction.followUp(createContainerMessage('Hata', 'Hatırlatıcı bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            await conn.query('UPDATE reminders SET sent = TRUE WHERE id = ?', [id]);
            const payload = createContainerMessage('Hatırlatıcı', `~~${rows[0].message}~~\n\n-# Tamamlandı olarak işaretlendi.`, '#57F287');
            await interaction.editReply({ ...payload, components: [] }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    if (customId.startsWith('rem_snooze_')) {
        await interaction.deferUpdate().catch(() => {});
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [id, interaction.user.id]);
            if (rows.length === 0) {
                return interaction.followUp(createContainerMessage('Hata', 'Hatırlatıcı bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            const next = new Date(Date.now() + 10 * 60 * 1000);
            await conn.query('UPDATE reminders SET remind_at = ?, sent = FALSE WHERE id = ?', [next, id]);
            const payload = createContainerMessage(
                'Hatırlatıcı Ertelendi',
                `<@${interaction.user.id}>\n\n**Hatırlatma:**\n${rows[0].message}\n\n-# Yeni zaman: <t:${Math.floor(next.getTime() / 1000)}:R>`,
                '#FEE75C', reminderButtons(id)
            );
            await interaction.editReply(payload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    if (customId.startsWith('rem_del_')) {
        await interaction.deferUpdate().catch(() => {});
        let conn;
        try {
            conn = await db.pool.getConnection();
            await conn.query('DELETE FROM reminders WHERE id = ? AND user_id = ?', [id, interaction.user.id]);
            await interaction.editReply({ ...createContainerMessage('Silindi', 'Hatırlatıcı silindi.', '#57F287'), components: [] }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
}

module.exports = { handleReminderInteractions, reminderButtons };
