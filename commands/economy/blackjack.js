const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { tables, gid, bjRows, bjText, bjValue, drawCard } = require('../../utils/ecofunHandler');
const eco = require('../../utils/globalEco');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Krupiyeye karşı 21 (kazanırsan 2x).')
        .addIntegerOption(o => o.setName('bahis').setDescription('Bahis miktarı').setRequired(true).setMinValue(10).setMaxValue(10000)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const bet = interaction.options.getInteger('bahis');
        const paid = await eco.takeBalance(interaction.user.id, bet);
        if (!paid) {
            return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Bahis için ${bet} Jeton lazım.`, '#FEE75C', [], [], false, true));
        }

        const id = gid();
        const t = { player: [drawCard(), drawCard()], dealer: [drawCard(), drawCard()], bet, user: interaction.user.id, t: Date.now() };
        tables.set('bj' + id, t);

        if (bjValue(t.player) === 21) {
            const win = Math.floor(bet * 2);
            await eco.addBalance(interaction.user.id, win);
            tables.delete('bj' + id);
            return interaction.editReply(createContainerMessage('Blackjack', `Elin: **${t.player.join(' • ')}** (21)\n\nBLACKJACK! **+${win}** Jeton!`, '#57F287', []));
        }
        await interaction.editReply(createContainerMessage('Blackjack', bjText(t), '#5865F2', bjRows(id)));
    }
};
