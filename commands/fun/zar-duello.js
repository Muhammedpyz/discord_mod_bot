const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { games, gid, zardRows } = require('../../utils/gameHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zar-düello')
        .setDescription('Rakiple zar düellosu (kazanan 50 Jeton).')
        .addUserOption(o => o.setName('rakip').setDescription('Rakibin').setRequired(true)),

    async execute(interaction) {
        const rakip = interaction.options.getUser('rakip');
        if (rakip.id === interaction.user.id || rakip.bot) {
            await interaction.reply(createContainerMessage('Hata', 'Gerçek bir rakip etiketle.', '#ED4245'));
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
        const id = gid();
        games.set('zard' + id, { p1: interaction.user.id, p2: rakip.id, r1: null, r2: null, over: false, t: Date.now() });
        const payload = createContainerMessage('Zar Düello', `<@${interaction.user.id}> vs <@${rakip.id}>\n\nHerkes **Zarını At** butonuna bir kez bassın. Büyük atan kazanır!\n\n-# Ödül: 50 Jeton`, '#5865F2', zardRows(id));
        await interaction.editReply(payload);
    }
};
