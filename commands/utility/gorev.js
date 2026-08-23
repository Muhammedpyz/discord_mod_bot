const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildDailyQuestPanel } = require('../../utils/questManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gorev')
        .setDescription('Günlük Minecraft görevlerinizi ve XP ödüllerinizi görüntüler')
        .setDMPermission(false),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const payload = await buildDailyQuestPanel(
            interaction.guildId,
            interaction.user.id,
            interaction.user.displayName || interaction.user.username
        );
        payload.flags = MessageFlags.IsComponentsV2;

        await interaction.editReply(payload);
    }
};
