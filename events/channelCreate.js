const { Events, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../db');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel, client) {
        if (!channel.guild) return;

        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [channel.guild.id]);
            
            if (rows && rows.length > 0 && rows[0].banned_role_id) {
                const bannedRoleId = rows[0].banned_role_id;
                const role = channel.guild.roles.cache.get(bannedRoleId);
                
                if (role) {
                    // Yalnızca bir kereliğine (tek seferlik) izinleri eziyoruz. 
                    // Kullanıcı (yetkili) sonradan manuel açarsa bot tekrar müdahale etmez.
                    await channel.permissionOverwrites.create(role, {
                        ViewChannel: false,
                        Connect: false,
                        SendMessages: false
                    }).catch(() => {});
                }
            }
        } catch (error) {
            console.error('ChannelCreate (banned_role_id overrite) hatası:', error);
        } finally {
            if (conn) conn.release();
        }
    }
};
