const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temizle')
        .setDescription('Kanalda belirtilen miktarda mesaji siler.')
        .addIntegerOption(option => 
            option.setName('miktar')
                .setDescription('Silinecek mesaj sayisi (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Sadece bu kullanıcının mesajlarini siler (Opsiyonel)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        let amount = interaction.options.getInteger('miktar');
        const targetUser = interaction.options.getUser('kullanıcı');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (amount < 1 || amount > 100) {
                return interaction.editReply({ content: 'Lütfen 1 ile 100 arasinda bir deger giriniz.' });
            }

            let messages = await interaction.channel.messages.fetch({ limit: amount });

            if (targetUser) {
                messages = messages.filter(m => m.author.id === targetUser.id);
            }

            const deleted = await interaction.channel.bulkDelete(messages, true);

            const payload = createContainerMessage(
                `${EMOJIS.delete} Temizlik Tamamlandi`,
                `Başarıyla **${deleted.size}** adet mesaj silindi.` + (targetUser ? `\n*(Yalnizca <@${targetUser.id}> adlı kullanıcının mesajlari)*` : '') + '\n\n*Not: 14 gunden eski mesajlar Discord API kisitlamalari geregi toplu olarak silinememektedir.*',
                '#2ECC71'
            );

            await interaction.editReply(payload);

            const logPayload = createContainerMessage(
                `${EMOJIS.delete} Toplu Mesaj Silindi`,
                '',
                '#FF8800',
                [],
                [
                    { name: 'Kanal', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Silinen Mesaj Sayısı', value: `${deleted.size}`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error("Clear Command Error:", error);
            await interaction.editReply({ content: 'Mesajlar silinirken sistemsel bir hata oluştu. (Discord API kisitlamalari veya yetki sorunlari kaynakli olabilir).' });
        }
    }
};
