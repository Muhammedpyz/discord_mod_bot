const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLog } = require('../../utils/logger');
const { validateModTarget } = require('../../utils/permissions');
const { pool } = require('../../db');
const { restoreRoles } = require('../../utils/roleMemory');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yasak-kaldır')
        .setDescription('Kullanıcının sunucu yasağını kaldirir.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Yasağı kaldırılacak kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const targetUser = interaction.options.getUser('kullanıcı');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return interaction.editReply({ content: 'Belirtilen kullanıcı sunucuda bulunamadı.' });
            }

            const configRows = await pool.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
            const config = configRows[0];

            if (!config || !config.banned_role_id) {
                return interaction.editReply({ content: 'Sistem yapılandırmasında yasaklı rolü (Banned) bulunamadı. Lütfen ayarları kontrol ediniz.' });
            }

            const bannedRoleId = config.banned_role_id;

            if (!targetMember.roles.cache.has(bannedRoleId)) {
                return interaction.editReply({ content: 'İşlem yapilan kullanıcı üzerinde yasaklı rolü bulunmamaktadır.' });
            }

            const validation = validateModTarget(interaction, targetUser, targetMember);
            if (!validation.valid) {
                return interaction.editReply({ content: validation.reason });
            }

            await targetMember.roles.remove(bannedRoleId);
            await restoreRoles(targetMember, 'warn3_ban');

            const logPayload = createContainerMessage(
                `${EMOJIS.unlock} Sunucu Yasağı Kaldırıldı`,
                '',
                '#313338',
                [],
                [
                    { name: 'Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
                ]
            );

            await sendLog(interaction.guild, logPayload);

            const successPayload = createContainerMessage(
                `${EMOJIS.unlock} Başarılı`,
                `**<@${targetUser.id}>** adlı kullanıcının sunucu yasağı başarıyla kaldırıldı.`,
                '#313338'
            );
            return interaction.editReply(successPayload);

        } catch (error) {
            console.error('Unban hatası:', error);
            return interaction.editReply({ content: 'İşlem sırasında sistemsel bir hata oluştu.' });
        }
    }
};
