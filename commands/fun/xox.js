const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { games, gid, xoxBoard } = require('../../utils/gameHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xox')
        .setDescription('Bir arkadaşınla XOX oynarsın (butonlu).')
        .addUserOption(o => o.setName('rakip').setDescription('Rakibin').setRequired(true)),

    async execute(interaction) {
        const rakip = interaction.options.getUser('rakip');
        if (rakip.id === interaction.user.id || rakip.bot) {
            await interaction.reply(createContainerMessage('Hata', 'Kendinle veya botla oynayamazsın, gerçek bir rakip etiketle.', '#ED4245'));
            return;
        }
        // Herkese açık tahta mesajı (paylaşımlı oyun)
        await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
        const id = gid();
        games.set('ox' + id, { b: Array(9).fill(null), pX: interaction.user.id, pO: rakip.id, turn: 'X', over: null, t: Date.now() });
        const g = games.get('ox' + id);
        const payload = createContainerMessage('XOX', `<@${g.pX}> (X) vs <@${g.pO}> (O)\n\nSıra: <@${g.pX}> (X)\n\n-# Kazanan 50 Jeton alır!`, '#5865F2', xoxBoard(id, g));
        const msg = await interaction.editReply(payload);
        g.messageId = msg.id;
    }
};
