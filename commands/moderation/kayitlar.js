const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kayıtlar')
        .setDescription('Bir üyenin geçmiş kayıtlarını gösterir.')
        .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getUser('uye');
        const rows = await db.pool.query('SELECT * FROM kayitlar WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10', [interaction.guild.id, uye.id]);
        if (rows.length === 0) {
            return interaction.editReply(createContainerMessage('Kayıtlar', 'Bu üyenin kayıt geçmişi yok.', '#3498DB', [], [], false, true));
        }
        let list = '';
        for (const r of rows) {
            list += `**${r.isim} | ${r.yas}** — <@${r.admin_id}> (<t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:d>)\n`;
        }
        await interaction.editReply(createContainerMessage(`${uye.username} — Kayıt Geçmişi`, list, '#5865F2'));
    }
};
