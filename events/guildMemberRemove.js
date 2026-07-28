const { Events } = require('discord.js');
const { pool, getGuildConfig } = require('../db');
const { createContainerMessage } = require('../utils/uiBuilder');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        let configRow;
        try {
            configRow = await getGuildConfig(member.guild.id);
        } catch(e) {
            console.error("Config hatasi guildMemberRemove:", e);
            return;
        }

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(`
                UPDATE members 
                SET is_in_guild = FALSE, last_leave = NOW(), username = ? 
                WHERE user_id = ?
            `, [member.user.username, member.id]);
        } catch (err) {
            console.error("Member leave update error:", err);
        } finally {
            if (conn) conn.release();
        }

        if (configRow) {
            let channel = null;
            if (configRow.goodbye_channel_id) {
                channel = member.guild.channels.cache.get(configRow.goodbye_channel_id);
            }
            
            if (!channel && configRow.welcome_channel_id) {
                channel = member.guild.channels.cache.get(configRow.welcome_channel_id);
            }

            if (channel) {
                const goodbyeMessages = [
                    "{user} sunucudan ayrıldı.",
                    "{user} aramızdan ayrıldı, kendisine başarılar dileriz.",
                    "Kullanıcı {user} sunucudan çıkış yaptı.",
                    "{user} ayrıldı. Yeniden görüşmek dileğiyle."
                ];
                const randomMsg = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)].replace('{user}', member.user.username);
                
                try {
                    const payload = createContainerMessage(
                        'Sunucudan Ayrılış',
                        `**${randomMsg}**\n\nGidişiyle beraber sunucuda **${member.guild.memberCount}** kişi kaldık.`,
                        '#FF0000'
                    );
                        
                    await channel.send(payload).catch(e => console.error("Goodbye mesaj hatasi:", e));
                } catch (sendError) {
                    console.error("Goodbye mesaj VEYA embed oluşturma hatası:", sendError);
                }
            }
        }
    }
};
