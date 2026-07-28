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

        let actionName = 'Sistem İşlemi';
        let detailLine = '';

        if (typeof payload === 'string') {
            detailLine = payload;
        } else if (payload && payload.components && payload.components[0] && payload.components[0].components) {
            let fields = [];
            for (const comp of payload.components[0].components) {
                if (comp.data && comp.data.content) {
                    let c = comp.data.content;
                    if (c.startsWith('#')) {
                        actionName = c.replace(/#/g, '').trim();
                    } else if (c.includes('**')) {
                        fields.push(c.replace(/\n/g, ' '));
                    }
                }
            }
            detailLine = fields.join(' | ');
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        
        let cleanDesc = detailLine.replace(/\s+/g, ' ').trim();
        if (cleanDesc.length > 500) cleanDesc = cleanDesc.substring(0, 500) + '...';

        const newEvent = `\`[${timeStr}]\` **${actionName}** | ${cleanDesc}\n`;

        let logMessageId = activeLogMessages.get(guild.id);
        let existingMsg = null;
        let currentText = `**— SUNUCU DENETİM KAYITLARI —**\n`;

        if (logMessageId) {
            try {
                existingMsg = await logChannel.messages.fetch(logMessageId);
                if (existingMsg && existingMsg.content) {
                    currentText = existingMsg.content;
                }
            } catch (err) {
                existingMsg = null;
            }
        }

        if (currentText.length + newEvent.length > 3800 || !existingMsg) {
            currentText = `**— SUNUCU DENETİM KAYITLARI —**\n` + newEvent;
            const newMsg = await logChannel.send({ content: currentText }).catch(()=>{});
            if (newMsg) activeLogMessages.set(guild.id, newMsg.id);
        } else {
            currentText += newEvent;
            await existingMsg.edit({ content: currentText }).catch(()=>{});
        }

    } catch (err) {
        console.error('[Logger] Hata:', err.message);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { sendLog };
