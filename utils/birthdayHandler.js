const { MessageFlags } = require('discord.js');
const db = require('../db');
const { createContainerMessage } = require('./uiBuilder');

async function handleBirthdayInteractions(interaction) {
    if (interaction.customId === 'bday_refresh') {
        await interaction.deferUpdate().catch(() => {});
        try {
            const rows = await db.pool.query('SELECT user_id, day, month, year FROM user_birthdays WHERE guild_id = ? ORDER BY month ASC, day ASC LIMIT 20', [interaction.guild.id]);
            if (rows.length === 0) {
                return interaction.editReply(createContainerMessage('Doğum Günleri', 'Kayıtlı doğum günü yok.', '#3498DB')).catch(() => {});
            }
            let list = '';
            for (const r of rows) {
                list += `<@${r.user_id}> — **${r.day}/${r.month}**${r.year ? `/${r.year}` : ''}\n`;
            }
            await interaction.editReply(createContainerMessage('Kayıtlı Doğum Günleri', list, '#5865F2')).catch(() => {});
        } catch (e) {
            console.error('[Bday refresh]:', e.message);
        }
    }
}

module.exports = { handleBirthdayInteractions };
