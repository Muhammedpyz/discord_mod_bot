const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { validateModTarget } = require('../../utils/permissions');
const { issueWarning } = require('../../utils/warningManager');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Bir kullaniciyi uyarir ve veritabanina kaydeder.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Uyarilacak kullanici')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Uyari sebebi')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
        
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.reply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply();

            const result = await issueWarning(interaction.guild, targetUser, interaction.user.id, reason);

            if (!result || !result.success) {
                return interaction.editReply({ content: 'Uyari verilirken veritabani hatasi olustu.' });
            }

            let fallbackMsg = '';
            if (!result.dmBasarili) {
                fallbackMsg = `\n*(Not: <@${targetUser.id}> adli kullaniciya ozel mesaj gonderilemedi, uyari yalnizca sistem uzerinden kaydedildi.)*`;
            }

            if (result.missingRole) {
                fallbackMsg += `\n\n**YETKILI BILGILENDIRME:** Kullaniciya uyari verilmistir ancak sistemde **${result.missingRoleMsg}** ayarlanmadigi icin rol islemi tamamlanamamistir. Lutfen ayarlari kontrol ediniz.`;
            }

            const extraActionText = result.extraAction ? `\n${result.extraAction}` : '';

            const payload = createContainerMessage(
                'Kullanici Uyarildi', 
                `<@${targetUser.id}> uyarildi.\n**Sebep:** ${reason}\n**Toplam Aktif Uyari:** ${result.totalWarns}\n*(Bu uyari ${result.daysToAdd} gun sonra pasiflesecek)*${extraActionText}${fallbackMsg}`,
                '#F1C40F'
            );

            await interaction.editReply(payload);

            const logPayload = createContainerMessage(
                'Kullanici Uyarildi',
                '',
                '#FFFF00',
                [],
                [
                    { name: 'Uyarilan Uye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: reason, inline: false },
                    { name: 'Aktif Uyari Sayisi', value: `${result.totalWarns}`, inline: true }
                ]
            );
            
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Warn hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
