const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');
const { JOKES } = require('../../utils/funHandler');
const { funCard } = require('../../utils/gifHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('espri')
        .setDescription('Rastgele espri yapar.'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fun_espri').setLabel('Yeni Espri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        const payload = await funCard('Espri', [JOKES[Math.floor(Math.random() * JOKES.length)]], [row], 'funny laugh');
        await interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }
};
