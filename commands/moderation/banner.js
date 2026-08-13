const { SlashCommandBuilder } = require('discord.js');
const { buildModBResponse, createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Bir kullanıcının bannerını görüntüler.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Bannerını görmek istediğiniz kullanıcı')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;
            const user = await interaction.client.users.fetch(targetUser.id, { force: true });
            
            const bannerUrl = user.bannerURL({ size: 4096, dynamic: true });

            if (!bannerUrl) {
                const noBannerPayload = createContainerMessage(
                    `${EMOJIS.status} Banner Bilgisi`,
                    `Bu kullanıcının banner'ı bulunmuyor.`,
                    '#2B2D31'
                );
                return await interaction.editReply(noBannerPayload);
            }

            const payload = buildModBResponse({
                title: `${EMOJIS.status} Banner Bilgisi`,
                textLines: [`Kullanıcı: <@${user.id}>`],
                images: [bannerUrl]
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Error in banner command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
