const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getGuildSetup } = require('../../db');
const { renderPrivateRoomMainPanel } = require('../../utils/privateRoomSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ozel-oda')
        .setDescription('Özel (Geçici) ses ve metin odaları sistemini yapılandırır ve yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (e) {
            return;
        }

        try {
            const setupInfo = await getGuildSetup(interaction.guild.id);
            const view = await renderPrivateRoomMainPanel(interaction.guild, setupInfo);
            await interaction.editReply(view);
        } catch (error) {
            console.error('ozel-oda execute error:', error);
            await interaction.editReply({ content: 'Özel oda paneli yüklenirken bir hata oluştu.' }).catch(() => {});
        }
    }
};
