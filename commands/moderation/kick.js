const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { validateModTarget } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kullaniciyi sunucudan atar.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Atilacak kullanici')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Atilma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Belirtilmedi';

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.reply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            if (!targetMember.kickable) {
                return interaction.reply({ content: 'Bu kullaniciyi sunucudan atma yetkim bulunmuyor. Rol hiyerarsisini kontrol ediniz.', flags: MessageFlags.Ephemeral });
            }

            try {
                const dmPayload = createContainerMessage('Sunucudan Atildiniz', `**${interaction.guild.name}** sunucusundan atildiniz.\n**Sebep:** ${reason}`, '#FF5500');
                await targetUser.send(dmPayload);
            } catch (dmError) {
                console.log('Kullaniciya bildirim gonderilemedi.');
            }

            await targetMember.kick(`Moderator: ${interaction.user.tag} | Sebep: ${reason}`);

            const payload = createContainerMessage(`${EMOJIS.kick} Kullanici Sunucudan Atildi`, `<@${targetUser.id}> sunucudan atildi.\n**Sebep:** ${reason}`, '#FF5500');
            await interaction.reply(payload);

            const logPayload = createContainerMessage(
                `${EMOJIS.kick} Kullanici Atildi`,
                '',
                '#FF5500',
                [],
                [
                    { name: 'Atilan Uye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                ]
            );
            
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Kick hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Kullanici atilirken sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Kullanici atilirken sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
