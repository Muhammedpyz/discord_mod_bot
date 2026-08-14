const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderDashboard } = require('../../utils/applicationSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkili-basvuru')
        .setDescription('Yetkili başvuru sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const payload = await renderDashboard(interaction.guild.id);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('Error in yetkili-basvuru command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
