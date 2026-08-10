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
            console.error("Config hatası guildMemberRemove:", e);
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
            
            const ticketRows = await conn.query('SELECT channel_id FROM tickets WHERE guild_id = ? AND owner_id = ? AND status = "open"', [member.guild.id, member.id]);
            if (ticketRows.length > 0) {
                const { closeTicketChannel } = require('../utils/ticketManager');
                for (const row of ticketRows) {
                    const ticketChannel = member.guild.channels.cache.get(row.channel_id);
                    if (ticketChannel) {
                        try {
                            const fakeInteraction = {
                                guild: member.guild,
                                channel: ticketChannel,
                                user: client.user,
                                member: member.guild.members.cache.get(client.user.id),
                                reply: async (obj) => { await ticketChannel.send(obj).catch(()=>{}); },
                                followUp: async (obj) => { await ticketChannel.send(obj).catch(()=>{}); },
                                replied: false,
                                deferred: false
                            };
                            await ticketChannel.send({ content: `**Sistem Bildirimi:** Bilet sahibi sunucudan ayrıldığı için bu bilet otomatik olarak kapatılıyor...` }).catch(()=>{});
                            await closeTicketChannel(fakeInteraction);
                        } catch (e) {
                            console.error("Yetim ticket kapatma hatası:", e);
                        }
                    }
                }
            }
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
                        '#313338'
                    );
                        
                    await channel.send(payload).catch(e => console.error("Goodbye mesaj hatası:", e));
                } catch (sendError) {
                    console.error("Goodbye mesaj VEYA embed oluşturma hatası:", sendError);
                }
            }
        }
    }
};
