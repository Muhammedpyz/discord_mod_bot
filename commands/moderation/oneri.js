const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { renderSuggestionAdminMenu } = require('../../utils/suggestionSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oneri')
        .setDescription('Gelişmiş V2 Öneri Sistemi yönetim paneli.')
        .addSubcommand(sub =>
            sub
                .setName('panel')
                .setDescription('Öneri sistemi yönetim panelini açar.')
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        try {
            const menu = await renderSuggestionAdminMenu(interaction.guild.id);
            await interaction.editReply(menu);
        } catch (error) {
            console.error('Error in oneri panel:', error);
            await interaction.editReply({ content: 'Panel yüklenirken bir hata oluştu.' }).catch(() => {});
        }
    }
};
