const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLog } = require('../../utils/logger');
const { validateModTarget } = require('../../utils/permissions');
const { pool } = require('../../db');
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

            const roleRows = await pool.query('SELECT role_id FROM user_roles WHERE user_id = ? AND guild_id = ?', [targetUser.id, interaction.guild.id]);
            const rolesToRestore = roleRows.map(row => row.role_id).filter(id => interaction.guild.roles.cache.has(id));
            
            await targetMember.roles.remove(bannedRoleId);
            
            if (rolesToRestore.length > 0) {
                await targetMember.roles.add(rolesToRestore);
                await pool.query('DELETE FROM user_roles WHERE user_id = ? AND guild_id = ?', [targetUser.id, interaction.guild.id]);
            }

            const logPayload = createContainerMessage(
                `${EMOJIS.unlock} Sunucu Yasağı Kaldırıldı`,
                '',
                '#2ECC71',
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
                '#00FF00'
            );
            return interaction.editReply(successPayload);

        } catch (error) {
            console.error('Unban hatası:', error);
            return interaction.editReply({ content: 'İşlem sırasında sistemsel bir hata oluştu.' });
        }
    }
};
