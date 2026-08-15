const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool, getGuildConfig } = require('../../db');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');
const { restoreRoles } = require('../../utils/roleMemory');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn-sil')
        .setDescription('Bir kullanıcının aktif uyarılarını sıfırlar veya siler.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Uyarıları silinecek kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (e) {
            return;
        }

        const targetUser = interaction.options.getUser('kullanici');
        let conn;

        try {
            conn = await pool.getConnection();

            // Set all active warnings to inactive
            const result = await conn.query('UPDATE warnings SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUser.id]);
            const deletedCount = result.affectedRows || 0;

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetMember) {
                const config = await getGuildConfig(interaction.guild.id);
                if (config) {
                    if (config.warn1_role_id && targetMember.roles.cache.has(config.warn1_role_id)) {
                        await targetMember.roles.remove(config.warn1_role_id).catch(() => {});
                    }
                    if (config.warn2_role_id && targetMember.roles.cache.has(config.warn2_role_id)) {
                        await targetMember.roles.remove(config.warn2_role_id).catch(() => {});
                    }
                    if (config.banned_role_id && targetMember.roles.cache.has(config.banned_role_id)) {
                        await targetMember.roles.remove(config.banned_role_id).catch(() => {});
                        await restoreRoles(targetMember).catch(() => {});
                    }
                }
            }

            const eCheck = getMonoEmoji('check') || getMonoEmoji('verify');
            const eWarning = getMonoEmoji('warning') || getMonoEmoji('shield');

            const payload = buildModBResponse({
                title: `${eCheck} Uyarılar Temizlendi`,
                textLines: [
                    `**Kullanıcı:** <@${targetUser.id}>`,
                    `**Silinen Aktif Uyarı Sayısı:** \`${deletedCount}\``,
                    `Kullanıcının tüm uyarı cezaları kaldırıldı ve rolleri temizlendi.`
                ],
                thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 })
            });

            await interaction.editReply(payload);

            const logPayload = buildModBResponse({
                title: `${eWarning} Uyarılar Sıfırlandı`,
                fields: [
                    { name: 'Kullanıcı', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Silinen Uyarı Sayısı', value: `${deletedCount}`, inline: true }
                ]
            });
            await sendLog(interaction.guild, logPayload, 'mod');

        } catch (error) {
            console.error('Warn-sil hatası:', error);
            await interaction.editReply({ content: 'Uyarılar silinirken bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
