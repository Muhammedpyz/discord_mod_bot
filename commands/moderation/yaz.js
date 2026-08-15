const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

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
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (e) {
            return;
        }
        
        try {
            const content = interaction.options.getString('mesaj');
            const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;

            const eCheck = getMonoEmoji('check') || getMonoEmoji('verify');
            const eMail = getMonoEmoji('message') || getMonoEmoji('channel');

            await targetChannel.send({ content });

            const payload = buildModBResponse({
                title: `${eCheck} Mesaj Gönderildi`,
                textLines: [`Mesaj başarıyla <#${targetChannel.id}> kanalına iletildi.`]
            });
            payload.flags = MessageFlags.IsComponentsV2;
            await interaction.editReply(payload);

            const logPayload = buildModBResponse({
                title: `${eMail} Bot Aracılığıyla Mesaj Gönderildi`,
                fields: [
                    { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Hedef Kanal', value: `<#${targetChannel.id}>`, inline: true },
                    { name: 'İçerik', value: content.length > 1024 ? content.substring(0, 1021) + '...' : content, inline: false }
                ]
            });
            await sendLog(interaction.guild, logPayload, 'text');
            
        } catch (error) {
            console.error('Error in yaz command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu. Botun kanala mesaj gönderme yetkisi olduğundan emin olun.' }).catch(() => {});
        }
    }
};
