const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildModAPanel, COLORS } = require('../../utils/uiBuilder');

function createHelpComponents(selected = 'home') {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('yardim:help_category_select')
            .setPlaceholder('Menüden Seçim Yapın')
            .addOptions([
                { label: 'Ana Sayfa', value: 'help_home', default: selected === 'home' },
                { label: 'Moderasyon', value: 'help_moderation', default: selected === 'moderation' },
                { label: 'Yönetim', value: 'help_system', default: selected === 'system' },
                { label: 'Güvenlik', value: 'help_security', default: selected === 'security' }
            ])
    );
}

function helpEmbedHome(guild, user, actionRows = []) {
    return buildModAPanel({
        title: 'Yönetim Paneli',
        description: `Sayın <@${user.id}>, sunucu yönetim ve güvenlik sistemleri yardım paneline hoş geldiniz.\n\nAşağıdaki menüyü kullanarak sistem komutları ve işlevleri hakkında detaylı bilgi alabilirsiniz.`,
        navRow: actionRows[0],
        showSocials: true
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Sistem yonetimi ve komutlar hakkinda bilgi almak icin yardim panelini acar.'),

    createHelpComponents,
    helpEmbedHome,

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const selectRow = createHelpComponents('home');
            const fullPayload = helpEmbedHome(interaction.guild, interaction.user, [selectRow]);
            fullPayload.flags |= MessageFlags.Ephemeral;
            await interaction.editReply(fullPayload);
        } catch (error) {
            console.error('Yardim hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Yardim menusu olusturulurken sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Yardim menusu olusturulurken sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            }
        }
    }
};
