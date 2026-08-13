const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool, updateConfigCache } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sayma-kanali')
        .setDescription('Sayma kanalını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcmd => 
            subcmd.setName('ayarla')
                .setDescription('Sayma kanalını ayarlar')
                .addChannelOption(opt => opt.setName('kanal').setDescription('Sayma kanalı').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('kapat')
                .setDescription('Sayma kanalını kapatır')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'ayarla') {
                const channel = interaction.options.getChannel('kanal');
                await conn.query('UPDATE guild_config SET counting_channel_id = ? WHERE guild_id = ?', [channel.id, interaction.guild.id]);
                updateConfigCache(interaction.guild.id, 'counting_channel_id', channel.id);

                await interaction.editReply(createContainerMessage(
                    `${EMOJIS.add} Sayma Kanalı`,
                    `Sayma kanalı başarıyla <#${channel.id}> olarak ayarlandı.`,
                    '#2B2D31'
                ));
            } else {
                await conn.query('UPDATE guild_config SET counting_channel_id = NULL WHERE guild_id = ?', [interaction.guild.id]);
                updateConfigCache(interaction.guild.id, 'counting_channel_id', null);

                await interaction.editReply(createContainerMessage(
                    `${EMOJIS.delete} Sayma Kanalı`,
                    `Sayma kanalı başarıyla kapatıldı.`,
                    '#2B2D31'
                ));
            }

        } catch (error) {
            console.error('Error in sayma-kanali command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
