const { Events } = require('discord.js');
const { pool } = require('../db');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!newMessage || !newMessage.channel || !newMessage.channel.name) return;

        if (newMessage.channel.name.startsWith('destek-')) {
            const isContentChanged = oldMessage && oldMessage.content !== newMessage.content;
            const isPinChanged = oldMessage && oldMessage.pinned !== newMessage.pinned;
            if (!isContentChanged && !isPinChanged) return; // No relevant change

            const messageId = newMessage.id;
            const channelId = newMessage.channel.id;

            let conn;
            try {
                conn = await pool.getConnection();
                
                if (isContentChanged) {
                    const oldContent = oldMessage ? oldMessage.content : '';
                    const newContent = newMessage.content || '';
                    await conn.query(
                        'UPDATE ticket_messages SET is_edited = TRUE, old_content = ?, edited_content = ? WHERE message_id = ? OR (channel_id = ? AND content = ?)',
                        [oldContent, newContent, messageId, channelId, oldContent]
                    );
                }
                
                if (isPinChanged) {
                    await conn.query(
                        'UPDATE ticket_messages SET is_pinned = ? WHERE message_id = ?',
                        [newMessage.pinned, messageId]
                    );
                }
            } catch (err) {
                console.error('[TicketUpdateLog] Hata:', err);
            } finally {
                if (conn) conn.release();
            }
        }

        if (oldMessage && oldMessage.content === newMessage.content) return; // No content change
        const author = oldMessage.author || newMessage.author;
        if (!author || author.bot) return;

        let config;
        try {
            const { getGuildConfig } = require('../db');
            config = await getGuildConfig(newMessage.guild.id);
        } catch (e) {}

        if (config && config.log_channel_id) {
            const { sendLog } = require('../utils/logger');
            const { createV2Message, COLORS } = require('../utils/uiBuilder');
            
            const oldContent = oldMessage.content ? oldMessage.content : '[Boş veya sadece eklenti]';
            const newContent = newMessage.content ? newMessage.content : '[Boş veya sadece eklenti]';

            const payload = createV2Message({
                title: 'Mesaj Düzenlendi',
                description: `**Kullanıcı:** ${author.tag} (<@${author.id}>)\n**Kanal:** <#${oldMessage.channel.id || newMessage.channel.id}>\n\n**Eski Mesaj:**\n\`\`\`text\n${oldContent.length > 1000 ? oldContent.substring(0, 1000) + '...' : oldContent}\n\`\`\`\n**Yeni Mesaj:**\n\`\`\`text\n${newContent.length > 1000 ? newContent.substring(0, 1000) + '...' : newContent}\n\`\`\`\n[Mesaja Git](${newMessage.url})`,
                color: COLORS.WARNING
            });
            await sendLog(newMessage.guild, payload, 'system').catch(()=>{});
        }
    }
};
