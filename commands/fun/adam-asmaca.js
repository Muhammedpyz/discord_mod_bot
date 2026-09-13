const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { games, gid } = require('../../utils/gameHandler');
const { pickWord } = require('../../utils/gameWords');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adam-asmaca')
        .setDescription('Klasik adam asmaca (6 hak, ödüllü).'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const word = pickWord().toLocaleLowerCase('tr-TR');
        const id = gid();
        games.set('asmaca' + id, { word, tahmin: [], hak: 6, user: interaction.user.id, t: Date.now() });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`asmaca_btn_${id}`).setLabel('Harf Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        await interaction.editReply(createContainerMessage('Adam Asmaca', `Kelime: **${[...word].map(() => '_').join(' ')}**\nKalan hak: **6**`, '#5865F2', [row]));
    }
};
