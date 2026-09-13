const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { tables, gid } = require('../../utils/ecofunHandler');
const eco = require('../../utils/globalEco');

function crashRows(id) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`crash_out_${id}`).setLabel('Çekil').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check)
    )];
}

module.exports = [
    {
        data: new SlashCommandBuilder().setName('rulet').setDescription('Rulet çevirirsin (renk/sayı/tek-çift).')
            .addIntegerOption(o => o.setName('bahis').setDescription('Bahis').setRequired(true).setMinValue(10).setMaxValue(10000))
            .addStringOption(o => o.setName('secim').setDescription('Bahsin').setRequired(true).addChoices(
                { name: 'Kırmızı (2x)', value: 'kirmizi' }, { name: 'Siyah (2x)', value: 'siyah' },
                { name: 'Tek (2x)', value: 'tek' }, { name: 'Çift (2x)', value: 'cift' },
                { name: 'Yeşil 0 (14x)', value: 'yesil' }
            )),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const bet = interaction.options.getInteger('bahis');
            const secim = interaction.options.getString('secim');
            const paid = await eco.takeBalance(interaction.user.id, bet);
            if (!paid) {
                return interaction.editReply(createContainerMessage('Yetersiz Bakiye', 'Bahis için paran yetmiyor.', '#FEE75C', [], [], false, true));
            }
            const KIRMIZI = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
            const sayi = Math.floor(Math.random() * 37);
            let mult = 0;
            if (secim === 'yesil' && sayi === 0) mult = 14;
            else if (secim === 'kirmizi' && KIRMIZI.includes(sayi)) mult = 2;
            else if (secim === 'siyah' && sayi !== 0 && !KIRMIZI.includes(sayi)) mult = 2;
            else if (secim === 'tek' && sayi % 2 === 1) mult = 2;
            else if (secim === 'cift' && sayi !== 0 && sayi % 2 === 0) mult = 2;
            const renk = sayi === 0 ? 'Yeşil' : KIRMIZI.includes(sayi) ? 'Kırmızı' : 'Siyah';
            let win = 0;
            if (mult > 0) {
                win = bet * mult;
                await eco.addBalance(interaction.user.id, win);
            }
            await interaction.editReply(createContainerMessage('Rulet', `Top **${sayi} (${renk})** geldi!\n\n${mult > 0 ? `Kazandın! **+${win}** Jeton` : `Kaybettin. **-${bet}** Jeton`}`, mult > 0 ? '#57F287' : '#ED4245'));
        }
    },
    {
        data: new SlashCommandBuilder().setName('crash').setDescription('Crash oyunu: patlamadan önce çekil!')
            .addIntegerOption(o => o.setName('bahis').setDescription('Bahis').setRequired(true).setMinValue(10).setMaxValue(10000)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const bet = interaction.options.getInteger('bahis');
            const paid = await eco.takeBalance(interaction.user.id, bet);
            if (!paid) {
                return interaction.editReply(createContainerMessage('Yetersiz Bakiye', 'Bahis için paran yetmiyor.', '#FEE75C', [], [], false, true));
            }
            const id = gid();
            const bust = 1.1 + Math.random() * Math.random() * 9;
            const g = { bet, mult: 1.0, bust, user: interaction.user.id, over: false, t: Date.now(), timer: null };
            tables.set('crash' + id, g);
            const payload = createContainerMessage('Crash', `Çarpan: **1.00x**\nBahis: ${bet} Jeton\n\n-# Patlamadan önce Çekil'e bas!`, '#5865F2', crashRows(id));
            await interaction.editReply(payload);
            g.timer = setInterval(async () => {
                const gg = tables.get('crash' + id);
                if (!gg || gg.over) { clearInterval(g.timer); return; }
                gg.mult += 0.15 + gg.mult * 0.06;
                if (gg.mult >= gg.bust) {
                    gg.over = true;
                    clearInterval(g.timer);
                    tables.delete('crash' + id);
                    const p = createContainerMessage('Crash', `**PATLIYOR!** ${gg.bust.toFixed(2)}x noktasında patladı.\nBahsin yandı: **-${gg.bet}** Jeton`, '#ED4245', []);
                    await interaction.editReply(p).catch(() => {});
                    return;
                }
                const p = createContainerMessage('Crash', `Çarpan: **${gg.mult.toFixed(2)}x** (şu an çekilsen +${Math.floor(gg.bet * gg.mult)})\nBahis: ${gg.bet} Jeton`, '#5865F2', crashRows(id));
                await interaction.editReply(p).catch(() => { clearInterval(g.timer); tables.delete('crash' + id); });
            }, 2000);
        }
    }
];
