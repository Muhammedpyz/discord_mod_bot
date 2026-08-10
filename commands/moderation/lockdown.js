const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Kanali kilitler veya kilidini acar (Guvenlik amaciyla kullanilir).')
        .addStringOption(option => 
            option.setName('durum')
                .setDescription('Kanal kilitlensin mi yoksa acilsin mi?')
                .setRequired(true)
                .addChoices(
                    { name: 'Kapat (Kilitle)', value: 'lock' },
                    { name: 'Ac (Kilidi Kaldır)', value: 'unlock' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const state = interaction.options.getString('durum');
            const role = interaction.guild.roles.everyone;

            const permissions = interaction.channel.permissionOverwrites.cache.get(role.id);
            const isCurrentlyLocked = permissions && permissions.deny.has(PermissionFlagsBits.SendMessages);

            if (state === 'lock' && isCurrentlyLocked) {
                return interaction.reply({ content: 'Bu kanal halihazirda kilitli durumdadir.', flags: MessageFlags.Ephemeral });
            }
            if (state === 'unlock' && !isCurrentlyLocked) {
                return interaction.reply({ content: 'Bu kanal halihazirda acik durumdadir.', flags: MessageFlags.Ephemeral });
            }

            if (state === 'lock') {
                await interaction.channel.permissionOverwrites.edit(role, { SendMessages: false });
                
                const payload = createContainerMessage(
                    `${EMOJIS.lock} Kanal Kilitlendi`,
                    'Sunucu guvenligi sebebiyle bu kanala mesaj gonderimi yetkililer tarafından gecici olarak durdurulmustur.',
                    '#313338'
                );
                
                await interaction.reply(payload);
            } else {
                await interaction.channel.permissionOverwrites.edit(role, { SendMessages: null });
                
                const payload = createContainerMessage(
                    `${EMOJIS.unlock} Kanal Erisime Acildi`,
                    'Kanal kısıtlaması kaldırılmış olup, sohbet erişimi tekrar aktif edilmistir.',
                    '#313338'
                );
                
                await interaction.reply(payload);
            }

            const logPayload = createContainerMessage(
                state === 'lock' ? `${EMOJIS.lock} Kanal Kilitlendi` : `${EMOJIS.unlock} Kanal Kilidi Acildi`,
                '',
                '#313338',
                [],
                [
                    { name: 'Kanal', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);
        } catch (error) {
            console.error('Lockdown hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Kanal ayarları değiştirilirken bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Kanal ayarları değiştirilirken bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
