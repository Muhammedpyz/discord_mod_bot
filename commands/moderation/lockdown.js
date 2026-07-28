const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
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
                    { name: 'Ac (Kilidi Kaldir)', value: 'unlock' }
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
                    'Kanal Kilitlendi',
                    'Sunucu guvenligi sebebiyle bu kanala mesaj gonderimi yetkililer tarafindan gecici olarak durdurulmustur.',
                    '#E74C3C'
                );
                
                await interaction.reply(payload);
            } else {
                await interaction.channel.permissionOverwrites.edit(role, { SendMessages: null });
                
                const payload = createContainerMessage(
                    'Kanal Erisime Acildi',
                    'Kanal kısıtlaması kaldirilmis olup, sohbet erisimi tekrar aktif edilmistir.',
                    '#2ECC71'
                );
                
                await interaction.reply(payload);
            }

            const logPayload = createContainerMessage(
                state === 'lock' ? 'Kanal Kilitlendi' : 'Kanal Kilidi Acildi',
                '',
                state === 'lock' ? '#E74C3C' : '#2ECC71',
                [],
                [
                    { name: 'Kanal', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);
        } catch (error) {
            console.error('Lockdown hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Kanal ayarlari degistirilirken bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Kanal ayarlari degistirilirken bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
