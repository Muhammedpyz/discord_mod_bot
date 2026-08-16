const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildVanityPanel } = require('../../utils/securityPanelHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vanity')
        .setDescription('Özel durumuna yazı ekleyen üyelere otomatik rol verir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
    }
};