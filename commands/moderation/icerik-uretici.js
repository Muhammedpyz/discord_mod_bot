const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderCreatorDashboard } = require('../../utils/creatorApplicationSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('icerik-uretici')
        .setDescription('İçerik üreticisi başvuru sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const payload = await renderCreatorDashboard(interaction.guild.id);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('Error in icerik-uretici command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
