const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildWelcomeMainPanel } = require('../../utils/welcomeSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hosgeldin')
        .setDescription('Karşılama ve uğurlama sistemini yapılandırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const panel = await buildWelcomeMainPanel(interaction.guildId);
        return await interaction.editReply(panel);
    }
};
