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
