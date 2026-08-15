const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sunucu-resim')
        .setDescription('Sunucunun profil fotoğrafını (ikon), afişini (banner) veya davet arka planını görüntüler.')
        .addStringOption(option =>
            option.setName('tür')
                .setDescription('Görüntülemek istediğiniz sunucu görseli türü')
                .setRequired(false)
                .addChoices(
                    { name: 'Sunucu İkonu (Profil Fotoğrafı)', value: 'icon' },
                    { name: 'Sunucu Afişi (Banner)', value: 'banner' },
                    { name: 'Davet Arka Planı (Splash)', value: 'splash' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const requestedType = interaction.options.getString('tür') || 'all';

        // URLs with dynamic support
        const iconDynamicUrl = guild.iconURL({ dynamic: true, size: 4096 });
        const iconStaticUrl = guild.iconURL({ extension: 'png', size: 4096 });
        const isIconAnimated = !!iconDynamicUrl && (iconDynamicUrl.includes('.gif') || iconDynamicUrl.includes('/a_'));

        const bannerDynamicUrl = guild.bannerURL({ dynamic: true, size: 4096 });
        const bannerStaticUrl = guild.bannerURL({ extension: 'png', size: 4096 });
        const isBannerAnimated = !!bannerDynamicUrl && (bannerDynamicUrl.includes('.gif') || bannerDynamicUrl.includes('/a_'));

        const splashUrl = guild.splashURL({ extension: 'png', size: 4096 });

        const container = new ContainerBuilder()
            .setAccentColor(0x2B2D31);

        const titleText = `## <:mono:${MONO_EMOJIS.image || '1537767802751164486'}> **${guild.name} | Sunucu Görselleri**\n` +
                          `> Sunucuya ait yüksek çözünürlüklü (HD) profil ve arka plan görselleri.`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleText));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const actionButtons = [];

        // 1. İKON (PP)
        if (requestedType === 'icon' || requestedType === 'all') {
            if (iconDynamicUrl) {
                const iconHeader = `### <:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Sunucu İkonu (Profil Fotoğrafı)**\n` +
                                   `<:mono:${MONO_EMOJIS.chevron_right}> Format: \`${isIconAnimated ? 'GIF (Hareketli)' : 'PNG (Statik)'}\` · Çözünürlük: \`HD (4096x4096)\``;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(iconHeader));

                const gallery = new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder({ media: { url: iconDynamicUrl } })
                );
                container.addMediaGalleryComponents(gallery);

                const iconRow = new ActionRowBuilder();
                if (isIconAnimated) {
                    iconRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('GIF İndir')
                            .setEmoji(MONO_EMOJIS.sparkles)
                            .setURL(iconDynamicUrl)
                            .setStyle(ButtonStyle.Link)
                    );
                } else {
                    iconRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('Resmi İndir')
                            .setEmoji(MONO_EMOJIS.image)
                            .setURL(iconStaticUrl)
                            .setStyle(ButtonStyle.Link)
                    );
                }
                actionButtons.push(iconRow);
            } else if (requestedType === 'icon') {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.cross}> Bu sunucuda ayarlanmış bir profil ikonu bulunmuyor.`));
            }
        }

        // 2. BANNER (AFİŞ)
        if (requestedType === 'banner' || (requestedType === 'all' && bannerDynamicUrl)) {
            if (bannerDynamicUrl) {
                if (requestedType === 'all') {
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                }
                const bannerHeader = `### <:mono:${MONO_EMOJIS.image || '1537767802751164486'}> **Sunucu Afişi (Banner)**\n` +
                                     `<:mono:${MONO_EMOJIS.chevron_right}> Format: \`${isBannerAnimated ? 'GIF (Hareketli)' : 'PNG (Statik)'}\` · Çözünürlük: \`HD (4096x2304)\``;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bannerHeader));

                const gallery = new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder({ media: { url: bannerDynamicUrl } })
                );
                container.addMediaGalleryComponents(gallery);

                const bannerRow = new ActionRowBuilder();
                if (isBannerAnimated) {
                    bannerRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('GIF Banner İndir')
                            .setEmoji(MONO_EMOJIS.sparkles)
                            .setURL(bannerDynamicUrl)
                            .setStyle(ButtonStyle.Link)
                    );
                } else {
                    bannerRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('Banner İndir')
                            .setEmoji(MONO_EMOJIS.image)
                            .setURL(bannerStaticUrl)
                            .setStyle(ButtonStyle.Link)
                    );
                }
                actionButtons.push(bannerRow);
            } else if (requestedType === 'banner') {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.cross}> Bu sunucuda ayarlanmış bir sunucu bannerı (afiş) bulunmuyor.`));
            }
        }

        // 3. SPLASH (DAVET ARKA PLANI)
        if (requestedType === 'splash' || (requestedType === 'all' && splashUrl)) {
            if (splashUrl) {
                if (requestedType === 'all') {
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                }
                const splashHeader = `### <:mono:${MONO_EMOJIS.invite || '1530917543491932196'}> **Davet Arka Planı (Splash)**\n` +
                                     `<:mono:${MONO_EMOJIS.chevron_right}> Format: \`PNG (Statik)\` · Çözünürlük: \`HD (4096x2304)\``;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(splashHeader));

                const gallery = new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder({ media: { url: splashUrl } })
                );
                container.addMediaGalleryComponents(gallery);

                const splashRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Splash İndir')
                        .setEmoji(MONO_EMOJIS.image)
                        .setURL(splashUrl)
                        .setStyle(ButtonStyle.Link)
                );
                actionButtons.push(splashRow);
            } else if (requestedType === 'splash') {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.cross}> Bu sunucuda ayarlanmış bir davet arka planı (splash) bulunmuyor.`));
            }
        }

        if (requestedType === 'all' && !iconDynamicUrl && !bannerDynamicUrl && !splashUrl) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.cross}> Bu sunucuda herhangi bir ikon, banner veya splash görseli bulunmuyor.`));
        }

        // Add action rows (max 5)
        for (const row of actionButtons.slice(0, 5)) {
            container.addActionRowComponents(row);
        }

        return await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
