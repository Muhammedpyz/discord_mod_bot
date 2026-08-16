const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder, SectionBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');
const db = require('../../db');

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

        // Hızlı çekiliş başlatma
        if (sure && kazanan_sayisi && odul) {
            // ... (Hızlı çekiliş mantığı, modal yerine doğrudan başlatacak. Bunu giveawayManager'da modal handler ile aynı fonksiyona bağlayabiliriz, ama şimdilik burada kalsın veya TODO olarak kalsın. Müşteri ana paneli istedi.)
            return interaction.reply({ content: 'Hızlı çekiliş henüz aktif değil, lütfen menüden "Yeni Çekiliş" butonunu kullanın.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const settings = await db.getGiveawaySettings(interaction.guild.id);
        
        const mainContainer = new ContainerBuilder();
        mainContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Çekiliş Sistemi`)
        );
        mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const descText = `Çekiliş açmak için kuruluma gerek yok — \`/giveaway 1g 1 Nitro\` yazman yeterli.\nAşağıdaki ayarlar yalnızca varsayılanları değiştirir.\n\n` +
            `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Yetkili Rolleri** › ${settings.manager_roles.length > 0 ? settings.manager_roles.map(r => `<@&${r}>`).join(', ') : 'sadece Sunucuyu Yönet yetkisi'}\n` +
            `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Log Kanalı** › ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : 'kapalı'}\n` +
            `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Duyuru Rolü** › ${settings.ping_role_id ? `<@&${settings.ping_role_id}>` : 'kapalı'}\n` +
            `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Kazanana DM** › ${settings.dm_winner ? 'Açık' : 'Kapalı'}\n` +
            `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Katılanlar Butonu** › ${settings.show_parts ? 'Açık' : 'Kapalı'}\n` +
            `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Engelli Roller** › ${settings.ignored_roles.length > 0 ? settings.ignored_roles.map(r => `<@&${r}>`).join(', ') : 'kapalı'}`;

        const section = new SectionBuilder();
        section.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
        mainContainer.addSectionComponents(section);

        const activeGWs = await db.getGuildGiveaways(interaction.guild.id);
        const activeCount = activeGWs.filter(g => g.status === 'active').length;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Şu anda ${activeCount} aktif çekiliş var.`));
        mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('gw_new')
                .setLabel('Yeni Çekiliş')
                .setStyle(ButtonStyle.Success)
                .setEmoji(MONO_EMOJIS.plus || '1530917512333787166'),
            new ButtonBuilder()
                .setCustomId('gw_list')
                .setLabel('Çekilişler')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(MONO_EMOJIS.search || '1530917529424367626')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('gw_settings')
                .setLabel('Ayarlar')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(MONO_EMOJIS.settings || '1530917467650523176')
        );

        mainContainer.addActionRowComponents(row1);
        mainContainer.addActionRowComponents(row2);

        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [mainContainer] });
    }
};
