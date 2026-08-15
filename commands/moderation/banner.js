const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Bir kullanıcının afişini (bannerını) görüntüler.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Bannerını görmek istediğiniz kullanıcı')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;
            const user = await interaction.client.users.fetch(targetUser.id, { force: true });

            const bannerUrl = user.bannerURL({ size: 4096, dynamic: true });
            const isBannerAnimated = bannerUrl && (bannerUrl.includes('.gif') || bannerUrl.includes('/a_'));

            const container = new ContainerBuilder().setAccentColor(0x2B2D31);

            const title = `## <:mono:${MONO_EMOJIS.image || '1537767802751164486'}> **${user.username} | Banner Bilgisi**\n` +
                          `> Kullanıcı: <@${user.id}> (\`${user.tag}\`)`;

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            if (!bannerUrl) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.cross}> Bu kullanıcının özel bir profil afişi (bannerı) bulunmuyor.`));
                return await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const gallery = new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder({ media: { url: bannerUrl } })
            );
            container.addMediaGalleryComponents(gallery);

            const row = new ActionRowBuilder();
            if (isBannerAnimated) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('GIF Banner İndir')
                        .setEmoji(MONO_EMOJIS.sparkles)
                        .setURL(bannerUrl)
                        .setStyle(ButtonStyle.Link)
                );
            } else {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('Resmi İndir')
                        .setEmoji(MONO_EMOJIS.image)
                        .setURL(bannerUrl)
                        .setStyle(ButtonStyle.Link)
                );
            }

            container.addActionRowComponents(row);

            return await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Banner komutu hatası:', error);
            await interaction.editReply({ content: 'Banner alınırken hata oluştu.' }).catch(() => {});
        }
    }
};
