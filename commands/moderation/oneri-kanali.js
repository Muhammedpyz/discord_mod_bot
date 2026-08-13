const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool, updateConfigCache } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oneri-kanali')
        .setDescription('Öneri kanalını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('kanal').setDescription('Öneri kanalı').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            conn = await pool.getConnection();
            const channel = interaction.options.getChannel('kanal');

            await conn.query('UPDATE guild_config SET suggestion_channel_id = ? WHERE guild_id = ?', [channel.id, interaction.guild.id]);
            updateConfigCache(interaction.guild.id, 'suggestion_channel_id', channel.id);

            await interaction.editReply(createContainerMessage(
                `${EMOJIS.settings} Öneri Kanalı`,
                `Öneri kanalı başarıyla <#${channel.id}> olarak ayarlandı.`,
                '#2B2D31'
            ));

        } catch (error) {
            console.error('Error in oneri-kanali command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
