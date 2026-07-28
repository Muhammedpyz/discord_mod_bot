const { pool } = require('../db');
const { MessageFlags } = require('discord.js');

const activeLogMessages = new Map();

async function sendLog(guild, payload) {
    if (!guild) return;

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT log_channel_id FROM guild_config WHERE guild_id = ?', [guild.id]);
        if (!rows.length || !rows[0].log_channel_id) return;

        const channelId = rows[0].log_channel_id;
        let logChannel = guild.channels.cache.get(channelId);
        if (!logChannel) {
            try { logChannel = await guild.channels.fetch(channelId); } catch { return; }
        }
        if (!logChannel) return;

        const botPerms = logChannel.permissionsFor(guild.members.me);
        if (!botPerms || !botPerms.has('SendMessages')) return;

        if (typeof payload === 'string') {
            const { createContainerMessage } = require('./uiBuilder');
            payload = createContainerMessage('Sistem Kaydı', payload, '#808080');
        }
        await logChannel.send(payload).catch(()=>{});

    } catch (err) {
        console.error('[Logger] Hata:', err.message);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { sendLog };
