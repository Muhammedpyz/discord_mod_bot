const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yaz')
        .setDescription('Botun hesabından belirtilen kanala mesaj gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('mesaj')
                .setDescription('Gönderilecek mesajın içeriği')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Mesajın gönderileceği kanal (boş bırakılırsa mevcut kanal)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const content = interaction.options.getString('mesaj');
            const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;

            await targetChannel.send({ content });

            const payload = createContainerMessage(
                `${EMOJIS.mail} Mesaj Gönderildi`,
                `Mesaj başarıyla ${targetChannel} kanalına gönderildi.`,
                '#2B2D31'
            );
            await interaction.editReply(payload);

            const logPayload = createContainerMessage(
                'Bot Aracılığıyla Mesaj Gönderildi',
                '',
                '#2B2D31',
                [],
                [
                    { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Hedef Kanal', value: `<#${targetChannel.id}>`, inline: true },
                    { name: 'İçerik', value: content.length > 1024 ? content.substring(0, 1021) + '...' : content, inline: false }
                ]
            );
            await sendLog(interaction.guild, logPayload);
            
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu. Botun kanala mesaj gönderme yetkisi olduğundan emin olun.' }).catch(() => {});
        }
    }
};
