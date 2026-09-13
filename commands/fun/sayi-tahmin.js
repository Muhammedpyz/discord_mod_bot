const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { games, gid } = require('../../utils/gameHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sayı-tahmin')
        .setDescription('Tuttuğum sayıyı tahmin et (10 hak, ödüllü).')
        .addIntegerOption(o => o.setName('maksimum').setDescription('Üst sınır (varsayılan 100)').setRequired(false).setMinValue(10).setMaxValue(1000)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const max = interaction.options.getInteger('maksimum') || 100;
        const id = gid();
        games.set('sayi' + id, { num: 1 + Math.floor(Math.random() * max), max, deneme: 0, user: interaction.user.id, t: Date.now() });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`sayi_btn_${id}`).setLabel('Tahmin Et').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
        );
        await interaction.editReply(createContainerMessage('Sayı Tahmin', `1-${max} arası bir sayı tuttum. 10 hakkın var!\n\n-# Az denemede bul, çok Jeton kazan.`, '#5865F2', [row]));
    }
};
