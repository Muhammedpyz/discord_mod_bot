const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool, updateConfigCache } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ghost-ping')
        .setDescription('Ghost ping korumasını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcmd => subcmd.setName('ac').setDescription('Ghost ping korumasını açar'))
        .addSubcommand(subcmd => subcmd.setName('kapat').setDescription('Ghost ping korumasını kapatır')),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();
            const isEnabled = subcommand === 'ac';

            await conn.query('UPDATE guild_config SET ghost_ping_enabled = ? WHERE guild_id = ?', [isEnabled, interaction.guild.id]);
            updateConfigCache(interaction.guild.id, 'ghost_ping_enabled', isEnabled);

            const statusText = isEnabled ? 'açıldı' : 'kapatıldı';
            await interaction.editReply(createContainerMessage(
                `${EMOJIS.shield} Ghost Ping Koruması`,
                `Ghost ping koruması başarıyla ${statusText}.`,
                '#2B2D31'
            ));

        } catch (error) {
            console.error('Error in ghost-ping command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
