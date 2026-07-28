const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyaritemizle')
        .setDescription('Bir kullanicinin tum aktif uyarilarini sifirlar.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Uyarilari sifirlanacak kullanici')
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
                    'Uyari Sifirlama Islemi',
                    `<@${targetUser.id}> adli kullanicinin toplam **${affected}** adet aktif uyarisi basariyla sifirlanmistir.`,
                    '#2ECC71'
                );
                    
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Uyarilar Sifirlandi',
                    '',
                    '#FFAA00',
                    [],
                    [
                        { name: 'Kullanici', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Sifirlanan Adet', value: `${affected}`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);
            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error("Uyari temizleme hatasi:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Uyarilar sifirlanirken bir veritabani hatasi olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Uyarilar sifirlanirken bir veritabani hatasi olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
