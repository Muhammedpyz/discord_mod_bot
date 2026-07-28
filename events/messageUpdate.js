const { Events } = require('discord.js');
const { pool } = require('../db');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!newMessage || !newMessage.channel || !newMessage.channel.name) return;

        if (newMessage.channel.name.startsWith('destek-')) {
            if (oldMessage && oldMessage.content === newMessage.content) return; // No content change

            const messageId = newMessage.id;
            const channelId = newMessage.channel.id;
            const oldContent = oldMessage ? oldMessage.content : '';
            const newContent = newMessage.content || '';

            let conn;
            try {
                conn = await pool.getConnection();
                await conn.query(
                    'UPDATE ticket_messages SET is_edited = TRUE, old_content = ?, edited_content = ? WHERE message_id = ? OR (channel_id = ? AND content = ?)',
                    [oldContent, newContent, messageId, channelId, oldContent]
                );
            } catch (err) {
                console.error('[TicketUpdateLog] Hata:', err);
            } finally {
                if (conn) conn.release();
            }
        }
    }
};
