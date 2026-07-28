const { pool } = require('../db');
const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('./uiBuilder');

const activeLogMessages = new Map(); // key: guild.id + actionName
const logLocks = new Map(); // key: guild.id + actionName

async function sendLog(guild, payload) {
    if (!guild) return;

    let actionName = 'Sistem İşlemi';
    let detailLine = '';

    if (typeof payload === 'string') {
        detailLine = payload;
    } else if (payload && payload.components && payload.components[0] && payload.components[0].components) {
        let fields = [];
        let extraContent = [];
        for (const comp of payload.components[0].components) {
            if (comp.data && comp.data.content) {
                let c = comp.data.content;
                if (c.startsWith('#') || c.startsWith('###')) {
                    actionName = c.replace(/#/g, '').trim();
                } else if (c.includes('**')) {
                    if (c.includes('**Silinen İçerik:**') || c.includes('**Eski İçerik:**') || c.includes('**Yeni İçerik:**')) {
                        // Keep these fields on a new line, and don't strip their spaces as aggressively
                        extraContent.push(c);
                    } else {
                        fields.push(c.replace(/\n/g, ' '));
                    }
                }
            }
        }
        detailLine = fields.join(' | ');
        if (extraContent.length > 0) {
            detailLine += '\n' + extraContent.join('\n');
        }
    }

    const lockKey = `${guild.id}-${actionName}`;
    
    let currentLock = logLocks.get(lockKey) || Promise.resolve();
    let releaseLock;
    const nextLock = new Promise(resolve => releaseLock = resolve);
    logLocks.set(lockKey, currentLock.then(() => nextLock));

    await currentLock;

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

        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let cleanDesc = detailLine.trim();
        if (cleanDesc.length > 1000) cleanDesc = cleanDesc.substring(0, 1000) + '...';

        const newEvent = `\`[${timeStr}]\` ${cleanDesc}`;

        let logData = activeLogMessages.get(lockKey);
        let existingMsg = null;
        let currentText = '';

        if (logData) {
            try {
                existingMsg = await logChannel.messages.fetch(logData.id);
                currentText = logData.text;
            } catch (err) {
                existingMsg = null;
            }
        }

        if (currentText.length + newEvent.length > 3800 || !existingMsg) {
            currentText = newEvent;
            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.settings || '⚙️'} ${actionName}`)
                .setDescription(currentText)
                .setColor(COLORS.PRIMARY || '#2B2D31')
                .setTimestamp();

            const newMsg = await logChannel.send({ embeds: [embed] }).catch(()=>{});
            if (newMsg) activeLogMessages.set(lockKey, { id: newMsg.id, text: currentText });
        } else {
            currentText += '\n' + newEvent;
            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.settings || '⚙️'} ${actionName}`)
                .setDescription(currentText)
                .setColor(COLORS.PRIMARY || '#2B2D31')
                .setTimestamp();
                
            await existingMsg.edit({ embeds: [embed] }).catch(()=>{});
            activeLogMessages.set(lockKey, { id: existingMsg.id, text: currentText });
        }

    } catch (err) {
        console.error('[Logger] Hata:', err.message);
    } finally {
        if (conn) conn.release();
        releaseLock();
        if (logLocks.get(lockKey) === nextLock) {
            logLocks.delete(lockKey);
        }
    }
}

module.exports = { sendLog };
