const { Events } = require('discord.js');
const { pool } = require('../db');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild || !channel.id) return;

        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query('SELECT * FROM tickets WHERE channel_id = ? AND status = "open"', [channel.id]);
            if (rows.length > 0) {
                const ticket = rows[0];
                await conn.query(
                    'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE id = ?',
                    [ticket.id]
                );
                console.log(`[ChannelDelete] Silinen ticket kanalı #${channel.name} (ID: ${ticket.id}) veritabanında kapalı olarak işaretlendi.`);
            }
        } catch (err) {
            console.error('[ChannelDelete Error]:', err);
        } finally {
            if (conn) conn.release();
        }
    }
};
