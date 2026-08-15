const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Bir kullanıcının global veya sunucu avatarını görüntüler.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Avatarını görmek istediğiniz kullanıcı')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const user = interaction.options.getUser('kullanici') || interaction.user;
            const member = interaction.guild?.members.cache.get(user.id);

            const globalAvatarUrl = user.displayAvatarURL({ size: 4096, dynamic: true });
            const isGlobalAnimated = globalAvatarUrl && (globalAvatarUrl.includes('.gif') || globalAvatarUrl.includes('/a_'));

            const guildAvatarUrl = member?.avatar ? member.displayAvatarURL({ size: 4096, dynamic: true }) : null;
            const isGuildAnimated = guildAvatarUrl && (guildAvatarUrl.includes('.gif') || guildAvatarUrl.includes('/a_'));

            const container = new ContainerBuilder().setAccentColor(0x2B2D31);

            const title = `## <:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **${user.username} | Avatar Bilgisi**\n` +
                          `> Kullanıcı: <@${user.id}> (\`${user.tag}\`)`;

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            const gallery = new MediaGalleryBuilder();
            gallery.addItems(new MediaGalleryItemBuilder({ media: { url: globalAvatarUrl } }));

            if (guildAvatarUrl && guildAvatarUrl !== globalAvatarUrl) {
                gallery.addItems(new MediaGalleryItemBuilder({ media: { url: guildAvatarUrl } }));
            }

            container.addMediaGalleryComponents(gallery);

            const row = new ActionRowBuilder();
            if (isGlobalAnimated) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('Global GIF İndir')
                        .setEmoji(MONO_EMOJIS.sparkles)
                        .setURL(globalAvatarUrl)
                        .setStyle(ButtonStyle.Link)
                );
            } else {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('Global Resmi İndir')
                        .setEmoji(MONO_EMOJIS.image)
                        .setURL(globalAvatarUrl)
                        .setStyle(ButtonStyle.Link)
                );
            }

            if (guildAvatarUrl && guildAvatarUrl !== globalAvatarUrl) {
                if (isGuildAnimated) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setLabel('Sunucu GIF İndir')
                            .setEmoji(MONO_EMOJIS.sparkles)
                            .setURL(guildAvatarUrl)
                            .setStyle(ButtonStyle.Link)
                    );
                } else {
                    row.addComponents(
                        new ButtonBuilder()
                            .setLabel('Sunucu Resmi İndir')
                            .setEmoji(MONO_EMOJIS.image)
                            .setURL(guildAvatarUrl)
                            .setStyle(ButtonStyle.Link)
                    );
                }
            }

            container.addActionRowComponents(row);

            return await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Avatar komutu hatası:', error);
            await interaction.editReply({ content: 'Avatar alınırken hata oluştu.' }).catch(() => {});
        }
    }
};
