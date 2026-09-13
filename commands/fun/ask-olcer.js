const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');
const { askPercent, bar } = require('../../utils/funHandler');
const { funCard } = require('../../utils/gifHandler');

function verdict(p) {
    if (p >= 80) return ['Efsane uyum!', 'love kiss'];
    if (p >= 50) return ['İyi anlaşırsınız.', 'hug'];
    if (p >= 25) return ['Biraz çaba lazım.', 'friends'];
    return ['Kaçınılmaz son...', 'breakup'];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask-olcer')
        .setDescription('İki kişi arasındaki uyumu ölçer.')
        .addUserOption(o => o.setName('birinci').setDescription('Birinci kişi').setRequired(true))
        .addUserOption(o => o.setName('ikinci').setDescription('İkinci kişi').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const a = interaction.options.getUser('birinci');
        const b = interaction.options.getUser('ikinci') || interaction.user;
        const p = askPercent(a.id, b.id);
        const [text, query] = verdict(p);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fun_ask_${a.id}_${b.id}`).setLabel('Tekrar Ölç').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        const payload = await funCard('Aşk Ölçer', [`<@${a.id}> + <@${b.id}>`, '', `\`${bar(p)}\` %${p}`, '', `-# ${text}`], [row], query);
        await interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }
};
