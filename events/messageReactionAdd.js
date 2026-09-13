const { Events } = require('discord.js');
const db = require('../db');
const { upsertStarboard, matchesEmoji } = require('../utils/starboardHandler');

module.exports = {
    name: Events.MessageReactionAdd,
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

            if (!config.self_star_allowed && message.author.id === user.id) {
                await reaction.users.remove(user.id).catch(() => {});
                return;
            }

            const starCount = reaction.count ?? 1;
            if (starCount >= config.threshold) {
                await upsertStarboard(client, message, config, starCount);
            }
        } catch (e) {
            console.error('Starboard Error:', e.message);
        } finally {
            if (conn) conn.release();
        }
    }
};
