const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('AFK moduna geçersiniz.')
        .addStringOption(option => 
            option.setName('sebep')
                .setDescription('AFK olma sebebi')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            const reason = interaction.options.getString('sebep') || 'AFK';
            conn = await pool.getConnection();

            await conn.query(
                `INSERT INTO afk_users (user_id, guild_id, reason, set_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE reason = ?, set_at = CURRENT_TIMESTAMP`,
                [interaction.user.id, interaction.guild.id, reason, reason]
            );

            const payload = createContainerMessage(
                `${EMOJIS.status} AFK Modu`,
                `AFK moduna geçtiniz: ${reason}`,
                '#2B2D31'
            );
            await interaction.editReply(payload);

        } catch (error) {
            console.error('Error in afk command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
