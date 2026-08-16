const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildMainPanelPayload } = require('../../utils/giveawayManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Çekiliş yönetim sistemini açar veya hızlıca çekiliş başlatır.')
        .addStringOption(option => option.setName('sure').setDescription('Süre (örn: 1g, 1s, 30d)').setRequired(false))
        .addIntegerOption(option => option.setName('kazanan_sayisi').setDescription('Kazanan kişi sayısı').setRequired(false))
        .addStringOption(option => option.setName('odul').setDescription('Çekiliş ödülü').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const sure = interaction.options.getString('sure');
        const kazanan_sayisi = interaction.options.getInteger('kazanan_sayisi');
        const odul = interaction.options.getString('odul');

        if (sure && kazanan_sayisi && odul) {
            return interaction.reply({ content: 'Hızlı çekiliş henüz aktif değil, lütfen menüden "Yeni Çekiliş" butonunu kullanın.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply(await buildMainPanelPayload(interaction.guild.id));
    }
};