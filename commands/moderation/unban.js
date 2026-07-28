const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLog } = require('../../utils/logger');
const { validateModTarget } = require('../../utils/permissions');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Kullanicinin sunucu yasagini kaldirir.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Yasagi kaldirilacak kullanici')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const targetUser = interaction.options.getUser('user');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return interaction.editReply({ content: 'Belirtilen kullanici sunucuda bulunamadi.' });
            }

            const configRows = await pool.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
            const config = configRows[0];

            if (!config || !config.banned_role_id) {
                return interaction.editReply({ content: 'Sistem yapilandirmasinda yasakli rolu (Banned) bulunamadi. Lutfen ayarlari kontrol ediniz.' });
            }

            const bannedRoleId = config.banned_role_id;

            if (!targetMember.roles.cache.has(bannedRoleId)) {
                return interaction.editReply({ content: 'Islem yapilan kullanici uzerinde yasakli rolu bulunmamaktadir.' });
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
                'Sunucu Yasagi Kaldirildi',
                '',
                '#2ECC71',
                [],
                [
                    { name: 'Kullanici', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
                ]
            );

            await sendLog(interaction.guild, logPayload);

            return interaction.editReply({ content: `${targetUser.tag} adli kullanicinin sunucu yasagi basariyla kaldirilmistir.` });

        } catch (error) {
            console.error('Unban hatasi:', error);
            return interaction.editReply({ content: 'Islem sirasinda sistemsel bir hata olustu.' });
        }
    }
};
