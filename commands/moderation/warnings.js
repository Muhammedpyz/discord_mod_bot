const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Kullanicinin uyari gecmisini gosterir.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Uyari gecmisi gosterilecek kullanici')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            
            let conn;
            try {
                conn = await pool.getConnection();
                const rows = await conn.query(
                    'SELECT id, moderator_id, reason, created_at FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 10',
                    [interaction.guild.id, targetUser.id]
                );

                if (!rows || rows.length === 0) {
                    return interaction.reply({ content: `<@${targetUser.id}> kullanicisinin aktif uyarisi bulunmamaktadir.`, flags: MessageFlags.Ephemeral });
                }

                const fields = rows.map((row) => {
                    const date = new Date(row.created_at).toLocaleDateString('tr-TR');
                    return {
                        name: `Uyari #${row.id} - ${date}`,
                        value: `**Sebep:** ${row.reason}\n**Yetkili:** <@${row.moderator_id}>`,
                        inline: false
                    };
                });

                const { buildModBResponse, COLORS } = require('../../utils/uiBuilder');
                const payload = buildModBResponse({
                    title: `${targetUser.tag} Uyari Gecmisi`,
                    textLines: ['Asagida kullanicinin son aktif uyarilari listelenmistir.'],
                    color: COLORS.PRIMARY,
                    fields
                });

                await interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });

            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error('Warnings hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Uyari gecmisi alinirken hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Uyari gecmisi alinirken hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
