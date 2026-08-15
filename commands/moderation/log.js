const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildLogMainPanel } = require('../../utils/logSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Gelişmiş 14 kategorili ve 51 olaylı sunucu log sistemini yapılandırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const panel = await buildLogMainPanel(interaction.guildId, interaction.guild);
        return await interaction.editReply(panel);
    }
};
