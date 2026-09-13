const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { slotSym } = require('../../utils/ecofunHandler');
const eco = require('../../utils/globalEco');

const SLOT_KEYS = ['star', 'gem', 'coins', 'crown', 'bell'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Slot makinesi (3 aynı = 3x).')
        .addIntegerOption(o => o.setName('bahis').setDescription('Bahis miktarı').setRequired(true).setMinValue(10).setMaxValue(10000)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const bet = interaction.options.getInteger('bahis');
        const paid = await eco.takeBalance(interaction.user.id, bet);
        if (!paid) {
            return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Bahis için ${bet} Jeton lazım.`, '#FEE75C', [], [], false, true));
        }
        const r = [SLOT_KEYS[Math.floor(Math.random() * 5)], SLOT_KEYS[Math.floor(Math.random() * 5)], SLOT_KEYS[Math.floor(Math.random() * 5)]];
        let mult = 0; let note = 'Kaybettin.';
        if (r[0] === r[1] && r[1] === r[2]) { mult = 3; note = 'JACKPOT! 3x kazandın!'; }
        else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { mult = 1.2; note = 'İkili! Paranın bir kısmı döndü.'; }
        let win = 0;
        if (mult > 0) {
            win = Math.floor(bet * mult);
            await eco.addBalance(interaction.user.id, win);
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`slot_go_${bet}`).setLabel(`Tekrar Çevir (${bet})`).setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh)
        );
        await interaction.editReply(createContainerMessage('Slots', `${slotSym(r[0])} ${slotSym(r[1])} ${slotSym(r[2])}\n\n${note}${win > 0 ? ` **+${win}** Jeton` : ` **-${bet}** Jeton`}`, mult >= 3 ? '#57F287' : mult > 0 ? '#FEE75C' : '#ED4245', [row]));
    }
};
