const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { games, gid } = require('../../utils/gameHandler');
const { pickWord, scramble } = require('../../utils/gameWords');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kelime-oyunu')
        .setDescription('Karışık harflerden kelimeyi bul (5 hak, ödüllü).'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const word = pickWord();
        const id = gid();
        games.set('kelime' + id, { word, scrambled: scramble(word), deneme: 0, user: interaction.user.id, t: Date.now() });
        const g = games.get('kelime' + id);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kelime_btn_${id}`).setLabel('Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        await interaction.editReply(createContainerMessage('Kelime Oyunu', `Karışık harfler: **${g.scrambled}**\n\n-# 5 hakkın var, kelime başına harf sayısı kadar Jeton.`, '#5865F2', [row]));
    }
};
