const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { games, gid, duelloRender } = require('../../utils/gameHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('düello')
        .setDescription('Bir rakiple sıra tabanlı düello yap (kazanan 75 Jeton).')
        .addUserOption(o => o.setName('rakip').setDescription('Rakibin').setRequired(true)),

    async execute(interaction) {
        const rakip = interaction.options.getUser('rakip');
        if (rakip.id === interaction.user.id || rakip.bot) {
            await interaction.reply(createContainerMessage('Hata', 'Gerçek bir rakip etiketle.', '#ED4245'));
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
        const id = gid();
        const g = { p1: interaction.user.id, p2: rakip.id, hp1: 100, hp2: 100, turn: interaction.user.id, log: [], over: null, t: Date.now() };
        games.set('duello' + id, g);
        // duelloRender interaction.message bekler; deferReply sonrası message üzerinden düzenle
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const { MONO_EMOJIS } = require('../../utils/uiBuilder');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`duello_atk_${id}`).setLabel('Saldır').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.swords),
            new ButtonBuilder().setCustomId(`duello_pes_${id}`).setLabel('Pes Et').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross)
        );
        const payload = createContainerMessage('Düello', `<@${g.p1}> vs <@${g.p2}>\n\nHerkes hazır! İlk vuran: <@${g.turn}>\n\n-# Kazanan 75 Jeton alır.`, '#5865F2', [row]);
        await interaction.editReply(payload);
    }
};
