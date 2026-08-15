const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getStaffPanelConfig, renderStaffSetupPanel } = require('../../utils/staffPanelSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkili-panosu')
        .setDescription('Yetkili kadrosu panosunu yapılandırır ve yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const config = await getStaffPanelConfig(interaction.guild.id);
            const payload = renderStaffSetupPanel(interaction.guild, config);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('yetkili-panosu command error:', error);
            await interaction.editReply({ content: 'Yetkili panosu ayarları yüklenirken bir hata oluştu.' });
        }
    }
};
