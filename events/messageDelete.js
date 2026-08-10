const { Events } = require('discord.js');
const { pool } = require('../db');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message || !message.channel || !message.channel.name) return;

        if (message.channel.name.startsWith('destek-')) {
            const messageId = message.id;
            const channelId = message.channel.id;
            const guildId = message.guild ? message.guild.id : '';

            let conn;
            try {
                conn = await pool.getConnection();
                // 1. Try to mark existing message as deleted
                const result = await conn.query(
                    'UPDATE ticket_messages SET is_deleted = TRUE WHERE message_id = ? OR (channel_id = ? AND content = ? AND is_deleted = FALSE)',
                    [messageId, channelId, message.content || '']
                );

                // 2. If message wasn't previously in DB, insert it with is_deleted = TRUE
                if (result.affectedRows === 0 && message.content) {
                    const authorTag = message.author ? (message.author.tag || message.author.username) : 'Bilinmeyen';
                    const authorAvatar = message.author ? message.author.displayAvatarURL({ size: 128, extension: 'png' }) : '';
                    
                    const attachArr = message.attachments ? message.attachments.map(a => ({ name: a.name, url: a.url, size: a.size })) : [];
                    const embedsArr = message.embeds ? message.embeds.map(e => ({
                        title: e.title,
                        description: e.description,
                        color: e.color,
                        fields: e.fields,
                        footer: e.footer,
                        image: e.image
                    })) : [];

                    const compsArr = message.components ? message.components.map(c => c.toJSON ? c.toJSON() : c) : [];
                    const stickersArr = message.stickers ? message.stickers.map(s => ({ id: s.id, name: s.name, url: s.url })) : [];
                    const replyToId = message.reference ? message.reference.messageId : null;
                    const isPinned = message.pinned || false;

                    await conn.query(
                        `INSERT INTO ticket_messages (message_id, guild_id, channel_id, ticket_owner_id, author_id, author_tag, author_avatar, content, attachments_json, embeds_json, components_json, stickers_json, reply_to_id, is_pinned, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
                        [messageId, guildId, channelId, '', message.author ? message.author.id : '0', authorTag, authorAvatar, message.content, JSON.stringify(attachArr), JSON.stringify(embedsArr), JSON.stringify(compsArr), JSON.stringify(stickersArr), replyToId, isPinned]
                    );
                }
            } catch (err) {
                console.error('[TicketDeleteLog] Hata:', err);
            } finally {
                if (conn) conn.release();
            }
        }
    }
};
