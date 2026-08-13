const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('re')
        .setDescription('Sunucuya başka bir sunucudan veya mesajdan emoji kopyalar (Emoji Çalma).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Kopyalanacak emoji (örnek: <:isim:id> veya <a:isim:id>)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const emojiString = interaction.options.getString('emoji');
            
            // Match custom emojis: <:name:id> or <a:name:id>
            const emojiRegex = /<a?:([^:]+):(\d+)>/;
            const match = emojiString.match(emojiRegex);
            
            if (!match) {
                const payload = createContainerMessage(
                    `${EMOJIS.cross} Geçersiz Emoji`,
                    `Lütfen geçerli bir özel emoji formatı girin. Varsayılan emojiler kopyalanamaz.`,
                    '#ED4245'
                );
                return await interaction.editReply(payload);
            }

            const isAnimated = emojiString.startsWith('<a:');
            const emojiName = match[1];
            const emojiId = match[2];
            const extension = isAnimated ? 'gif' : 'png';
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`;

            try {
                const newEmoji = await interaction.guild.emojis.create({ attachment: emojiUrl, name: emojiName });
                
                const payload = createContainerMessage(
                    `${EMOJIS.add} Emoji Eklendi`,
                    `Emoji başarıyla sunucuya eklendi: ${newEmoji}`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Emoji Çalındı/Eklendi',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Emoji', value: `${newEmoji} (\`${emojiName}\`)`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);

            } catch (err) {
                console.error('Emoji create error:', err);
                const payload = createContainerMessage(
                    `${EMOJIS.cross} İşlem Başarısız`,
                    `Emoji eklenemedi. Sunucu emoji limiti dolmuş olabilir veya dosya boyutu çok büyük olabilir.`,
                    '#ED4245'
                );
                await interaction.editReply(payload);
            }
            
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
