const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getAutoroleConfig, renderAutorolePanel } = require('../../utils/autoroleSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otorol')
        .setDescription('Sunucuya yeni katılan üyelere ve botlara otomatik verilecek rolleri ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (e) {
            return;
        }

        try {
            const config = await getAutoroleConfig(interaction.guild.id);
            const view = renderAutorolePanel(interaction.guild, config);
            await interaction.editReply(view);
        } catch (error) {
            console.error('Otorol execute error:', error);
            await interaction.editReply({ content: 'Otorol paneli yüklenirken bir hata oluştu.' }).catch(() => {});
        }
    }
};
