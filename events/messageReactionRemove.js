const { Events } = require('discord.js');
const db = require('../db');
const { renderStarboardEntry, matchesEmoji } = require('../utils/starboardHandler');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user, client) {
        if (user.bot) return;
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        const message = reaction.message;
        if (!message.guild || message.partial) {
            try { await message.fetch(); } catch { return; }
        }
        let conn;
        try {
            conn = await db.pool.getConnection();
            const configs = await conn.query('SELECT * FROM starboard_config WHERE guild_id = ?', [message.guild.id]);
            if (configs.length === 0) return;
            const config = configs[0];

            if (!matchesEmoji(reaction, config.emoji)) return;

            // Eşik altına düştüyse sil, üstündeyse AYNI mesajı düzenle
            await renderStarboardEntry(client, message.guild.id, message.id);
        } catch (e) {
            console.error('Starboard Remove Error:', e.message);
        } finally {
            if (conn) conn.release();
        }
    }
};
