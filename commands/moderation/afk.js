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
        try { await interaction.deferReply(); } catch(e) { return; }
        let conn;
        try {
            const reason = interaction.options.getString('sebep') || 'AFK';
            conn = await pool.getConnection();

            await conn.query(
                `INSERT INTO afk_users (user_id, guild_id, reason, set_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE reason = ?, set_at = CURRENT_TIMESTAMP`,
                [interaction.user.id, interaction.guild.id, reason, reason]
            );

            let extraMsg = '';
            if (interaction.member.voice.channelId) {
                const afkChannelId = interaction.guild.afkChannelId;
                if (afkChannelId) {
                    try {
                        await interaction.member.voice.setChannel(afkChannelId, 'AFK moduna geçti.');
                        await interaction.member.voice.setMute(true, 'AFK modunda');
                        await interaction.member.voice.setDeaf(true, 'AFK modunda');
                        extraMsg = '\n*(Ses kanalında olduğunuz için otomatik olarak AFK kanalına taşındınız ve sağırlaştırıldınız.)*';
                    } catch (e) {
                        console.error('AFK voice move err:', e);
                        extraMsg = '\n*(AFK kanalına taşınamadınız. Lütfen sunucu ayarlarında bir AFK kanalı seçili olduğundan emin olun.)*';
                    }
                } else {
                    extraMsg = '\n*(Sunucuda ayarlı bir AFK kanalı bulunamadı.)*';
                }
            }

            const payload = createContainerMessage(
                `${EMOJIS.status} AFK Modu`,
                `AFK moduna geçtiniz: **${reason}**${extraMsg}\n\nBir mesaj yazdığınızda AFK modundan otomatik çıkacaksınız.`,
                '#2B2D31'
            );
            await interaction.editReply(payload).catch(() => {});

        } catch (error) {
            console.error('Error in afk command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
