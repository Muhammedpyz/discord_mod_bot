const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { ballAnswer } = require('../../utils/funHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Sihirli 8 topuna soru sor.')
        .addStringOption(o => o.setName('soru').setDescription('Sorun nedir?').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const q = interaction.options.getString('soru');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fun_8ball').setLabel('Tekrar Sor').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        await interaction.editReply(createContainerMessage('Sihirli 8 Topu', `**Soru:** ${q}\n\n**Cevap:** ${ballAnswer(q + interaction.user.id)}`, '#5865F2', [row]));
    }
};
