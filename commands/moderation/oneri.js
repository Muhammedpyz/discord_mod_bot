const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { getGuildConfig } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oneri')
        .setDescription('Sunucu için bir öneride bulunursunuz.')
        .addStringOption(opt => opt.setName('oneri').setDescription('Öneriniz').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const config = await getGuildConfig(interaction.guild.id);
            if (!config || !config.suggestion_channel_id) {
                return await interaction.editReply(createContainerMessage(
                    `${EMOJIS.cross} Hata`,
                    `Bu sunucuda öneri kanalı ayarlanmamış.`,
                    '#2B2D31'
                ));
            }

            const suggestionChannel = interaction.guild.channels.cache.get(config.suggestion_channel_id);
            if (!suggestionChannel) {
                return await interaction.editReply(createContainerMessage(
                    `${EMOJIS.cross} Hata`,
                    `Öneri kanalı bulunamadı.`,
                    '#2B2D31'
                ));
            }

            const oneriText = interaction.options.getString('oneri');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('oneri_evet').setLabel('Evet').setStyle(ButtonStyle.Success).setEmoji('1124407421829988352').setDisabled(true), // We don't have exact unicode/emoji objects for these standard discord buttons usually, let's just use text
                new ButtonBuilder().setCustomId('oneri_hayir').setLabel('Hayır').setStyle(ButtonStyle.Danger).setDisabled(true)
            );

            // Removing setEmoji with fake id and re-defining buttons correctly
            const cleanRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('oneri_evet').setLabel('Evet (0)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('oneri_hayir').setLabel('Hayır (0)').setStyle(ButtonStyle.Danger)
            );


            const suggestionMessage = createContainerMessage(
                `${EMOJIS.announcement} Yeni Öneri`,
                `**Gönderen:** <@${interaction.user.id}>\n\n**Öneri:**\n${oneriText}`,
                '#2B2D31',
                [cleanRow]
            );

            await suggestionChannel.send(suggestionMessage);

            await interaction.editReply(createContainerMessage(
                `${EMOJIS.check} Başarılı`,
                `Öneriniz başarıyla gönderildi.`,
                '#2B2D31'
            ));

        } catch (error) {
            console.error('Error in oneri command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
