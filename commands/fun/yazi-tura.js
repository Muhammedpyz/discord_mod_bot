const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yazi-tura')
        .setDescription('Yazı tura atar.'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const r = Math.random() < 0.5 ? 'Yazı' : 'Tura';
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fun_yazi').setLabel('Tekrar At').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        await interaction.editReply(createContainerMessage('Yazı Tura', `**Sonuç: ${r}**`, '#5865F2', [row]));
    }
};
