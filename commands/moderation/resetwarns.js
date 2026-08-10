const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyarı-temizle')
        .setDescription('Bir kullanıcının tum aktif uyarılarını sıfırlar.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Uyarıları sıfırlanacak kullanıcı')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
        
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            let conn;
            try {
                conn = await pool.getConnection();
                
                const [result] = await conn.query(
                    'UPDATE warnings SET is_active = FALSE WHERE guild_id = ? AND user_id = ? AND is_active = TRUE',
                    [interaction.guild.id, targetUser.id]
                );

                const affected = result.affectedRows !== undefined ? result.affectedRows : 0;

                if (affected > 0) {
                    const [configRows] = await conn.query('SELECT warn1_role_id, warn2_role_id, banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                    if (configRows.length > 0) {
                        const config = configRows[0];
                        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                        if (member) {
                            const rolesToRemove = [];
                            if (config.warn1_role_id && member.roles.cache.has(config.warn1_role_id)) rolesToRemove.push(config.warn1_role_id);
                            if (config.warn2_role_id && member.roles.cache.has(config.warn2_role_id)) rolesToRemove.push(config.warn2_role_id);
                            if (config.banned_role_id && member.roles.cache.has(config.banned_role_id)) rolesToRemove.push(config.banned_role_id);
                            if (rolesToRemove.length > 0) {
                                await member.roles.remove(rolesToRemove, 'Uyarı temizleme: Uyarı rolleri otomatik kaldırıldı.').catch(()=>{});
                                
                                if (config.banned_role_id && rolesToRemove.includes(config.banned_role_id)) {
                                    const [roleRows] = await conn.query('SELECT role_id FROM user_roles WHERE user_id = ? AND guild_id = ?', [targetUser.id, interaction.guild.id]);
                                    const rolesToRestore = roleRows.map(row => row.role_id).filter(id => interaction.guild.roles.cache.has(id));
                                    if (rolesToRestore.length > 0) {
                                        await member.roles.add(rolesToRestore, 'Uyarı temizleme: Eski roller geri yüklendi.').catch(()=>{});
                                        await conn.query('DELETE FROM user_roles WHERE user_id = ? AND guild_id = ?', [targetUser.id, interaction.guild.id]);
                                    }
                                }
                            }
                        }
                    }
                }

                const payload = createContainerMessage(
                    'Uyarı Sıfırlama İşlemi',
                    `<@${targetUser.id}> adlı kullanıcının toplam **${affected}** adet aktif uyarısı başarıyla sıfırlanmıştır.`,
                    '#2ECC71'
                );
                    
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Uyarılar Sıfırlandı',
                    '',
                    '#FFAA00',
                    [],
                    [
                        { name: 'Kullanıcı', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Sifirlanan Adet', value: `${affected}`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);
            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error("Uyarı temizleme hatası:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Uyarılar sıfırlanırken bir veritabanı hatası oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Uyarılar sıfırlanırken bir veritabanı hatası oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
