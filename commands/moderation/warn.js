const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { validateModTarget } = require('../../utils/permissions');
const { issueWarning } = require('../../utils/warningManager');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Bir kullanıcıyı uyarır ve veritabanina kaydeder.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Uyarılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Uyarı sebebi')
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
                return interaction.editReply({ content: 'Uyarı verilirken veritabanı hatası oluştu.' });
            }

            let fallbackMsg = '';
            if (!result.dmBasarili) {
                fallbackMsg = `\n*(Not: <@${targetUser.id}> adlı kullanıcıya özel mesaj gönderilemedi, uyarı yalnızca sistem üzerinden kaydedildi.)*`;
            }

            if (result.missingRole) {
                fallbackMsg += `\n\n**YETKİLİ BİLGİLENDİRME:** Kullanıcıya uyarı verilmiştir ancak sistemde **${result.missingRoleMsg}** ayarlanmadığı için rol işlemi tamamlanamamıştır. Lütfen ayarları kontrol ediniz.`;
            }

            const extraActionText = result.extraAction ? `\n${result.extraAction}` : '';

            const payload = createContainerMessage(
                `${EMOJIS.warning} Kullanıcı Uyarıldı`, 
                `<@${targetUser.id}> uyarıldı.\n**Sebep:** ${reason}\n**Toplam Aktif Uyarı:** ${result.totalWarns}\n*(Bu uyarı ${result.daysToAdd} gün sonra pasifleşecek)*${extraActionText}${fallbackMsg}`,
                '#313338'
            );

            await interaction.editReply(payload);

            const logPayload = createContainerMessage(
                `${EMOJIS.warning} Kullanıcı Uyarıldı`,
                '',
                '#313338',
                [],
                [
                    { name: 'Uyarılan Üye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: reason, inline: false },
                    { name: 'Aktif Uyarı Sayısı', value: `${result.totalWarns}`, inline: true }
                ]
            );
            
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Warn hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
