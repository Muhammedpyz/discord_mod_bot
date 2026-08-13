const { SlashCommandBuilder } = require('discord.js');
const { buildModBResponse, EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Bir kullanıcının avatarını görüntüler.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Avatarını görmek istediğiniz kullanıcı')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const user = interaction.options.getUser('kullanici') || interaction.user;
            const member = interaction.guild.members.cache.get(user.id);
            
            const avatarUrl = user.displayAvatarURL({ size: 4096, dynamic: true });
            
            let textLines = [`Kullanıcı: <@${user.id}>`];
            const images = [avatarUrl];

            if (member) {
                const guildAvatar = member.displayAvatarURL({ size: 4096, dynamic: true });
                if (guildAvatar && guildAvatar !== avatarUrl) {
                    textLines.push('Sunucu avatarı da bulunmaktadır.');
                    images.push(guildAvatar);
                }
            }

            const payload = buildModBResponse({
                title: `${EMOJIS.status} Avatar Bilgisi`,
                textLines: textLines,
                images: images
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Error in avatar command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
