const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yavaş-mod')
        .setDescription('Kanalin yavaş modunu (slowmode) ayarlar.')
        .addIntegerOption(option => 
            option.setName('saniye')
                .setDescription('Kac saniye arayla mesaj atilabilsin? (Kapatmak için 0)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const seconds = interaction.options.getInteger('saniye');
            
            if (seconds < 0 || seconds > 21600) {
                return interaction.reply({ content: 'Lütfen 0 ile 21600 saniye (6 saat) arasinda geçerli bir deger giriniz.', flags: MessageFlags.Ephemeral });
            }
            
            await interaction.channel.setRateLimitPerUser(seconds, `Slowmode ayarlandi: ${interaction.user.tag}`);
            
            const payload = createContainerMessage(
                'Yavaş Mod Guncellendi',
                seconds === 0 ? 'Bu kanalda yavaş mod devreden çıkarıldı, mesaj gönderim hiz limiti kaldırıldı.' : `Bu kanalda yavaş mod **${seconds} saniye** olarak ayarlanmıştır.\nUyelerimiz her ${seconds} saniyede bir mesaj atabilecektir.`,
                seconds === 0 ? '#2ECC71' : '#E67E22'
            );
                
            await interaction.reply(payload);

            const logPayload = createContainerMessage(
                'Yavaş Mod Guncellendi',
                '',
                '#3498DB',
                [],
                [
                    { name: 'Kanal', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sure', value: `${seconds} saniye`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);
        } catch (error) {
            console.error('Slowmode hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Yavaş mod ayarlanirken bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Yavaş mod ayarlanirken bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
