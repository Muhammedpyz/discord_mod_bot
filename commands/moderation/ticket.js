const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderTicketDashboard } = require('../../utils/ticketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Bilet sistemi yönetim paneli.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const dashboard = await renderTicketDashboard(interaction.guild.id);
            if (!dashboard) {
                await interaction.editReply({ content: 'Sistem başlatılırken bir hata oluştu.' });
                return;
            }
            await interaction.editReply(dashboard);
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
