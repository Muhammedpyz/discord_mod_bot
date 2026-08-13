const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('itibar')
        .setDescription('İtibar sistemi')
        .addSubcommand(subcmd => 
            subcmd.setName('ver')
                .setDescription('Bir kullanıcıya itibar puanı ver')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('goruntule')
                .setDescription('Kullanıcının itibar puanını görüntüle')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(false))
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;

            if (subcommand === 'ver') {
                if (targetUser.id === interaction.user.id) {
                    return await interaction.editReply(createContainerMessage(`${EMOJIS.cross} Hata`, 'Kendinize itibar puanı veremezsiniz.', '#2B2D31'));
                }
                if (targetUser.bot) {
                    return await interaction.editReply(createContainerMessage(`${EMOJIS.cross} Hata`, 'Botlara itibar puanı veremezsiniz.', '#2B2D31'));
                }

                const [cooldownRes] = await conn.query('SELECT last_given FROM rep_cooldown WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
                if (cooldownRes) {
                    const lastGiven = new Date(cooldownRes.last_given).getTime();
                    const now = Date.now();
                    const diffHours = (now - lastGiven) / (1000 * 60 * 60);
                    if (diffHours < 24) {
                        const remaining = Math.ceil(24 - diffHours);
                        return await interaction.editReply(createContainerMessage(`${EMOJIS.cross} Hata`, `Tekrar itibar puanı verebilmek için ${remaining} saat beklemelisiniz.`, '#2B2D31'));
                    }
                }

                await conn.query('INSERT INTO reputation (guild_id, user_id, given_by) VALUES (?, ?, ?)', [interaction.guild.id, targetUser.id, interaction.user.id]);
                await conn.query('INSERT INTO rep_cooldown (guild_id, user_id, last_given) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE last_given = CURRENT_TIMESTAMP', [interaction.guild.id, interaction.user.id]);

                await interaction.editReply(createContainerMessage(`${EMOJIS.crown} İtibar Verildi`, `<@${targetUser.id}> kullanıcısına itibar puanı verdiniz!`, '#2B2D31'));
            } else if (subcommand === 'goruntule') {
                const rows = await conn.query('SELECT COUNT(*) as repCount FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
                const count = rows[0].repCount;
                await interaction.editReply(createContainerMessage(`${EMOJIS.crown} İtibar Bilgisi`, `<@${targetUser.id}> kullanıcısının toplam **${count}** itibar puanı bulunuyor.`, '#2B2D31'));
            }

        } catch (error) {
            console.error('Error in itibar command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
