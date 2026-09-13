const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zar')
        .setDescription('Zar atar.')
        .addIntegerOption(o => o.setName('adet').setDescription('Zar adedi (1-10)').setRequired(false).setMinValue(1).setMaxValue(10))
        .addIntegerOption(o => o.setName('yuz').setDescription('Zar yüzü (2-100)').setRequired(false).setMinValue(2).setMaxValue(100)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const a = interaction.options.getInteger('adet') || 1;
        const y = interaction.options.getInteger('yuz') || 6;
        const rolls = [];
        for (let i = 0; i < a; i++) rolls.push(1 + Math.floor(Math.random() * y));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fun_zar_${a}_${y}`).setLabel('Tekrar At').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        await interaction.editReply(createContainerMessage('Zar', `\`${rolls.join(' • ')}\`\n\n**Toplam:** ${rolls.reduce((x, v) => x + v, 0)}`, '#5865F2', [row]));
    }
};
