const { pool } = require('../db');
const { createContainerMessage } = require('./uiBuilder');

const raidCache = new Map();

async function handleAntiRaid(guild, member, client) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT limit_count, time_window, is_active FROM anti_raid_config WHERE guild_id = ?', [guild.id]);
        if (rows.length === 0 || !rows[0].is_active) return;
        
        const config = rows[0];
        const now = Date.now();
        
        if (!raidCache.has(guild.id)) {
            raidCache.set(guild.id, { joins: [] });
        }
        
        const guildData = raidCache.get(guild.id);
        guildData.joins.push(now);
        
        // Remove old joins outside the time window
        const timeWindowMs = config.time_window * 1000;
        guildData.joins = guildData.joins.filter(time => now - time <= timeWindowMs);
        
        if (guildData.joins.length >= config.limit_count && !guildData.locked) {
            guildData.locked = true; // prevent multiple triggers
            
            // Activate lockdown
            try {
                await guild.roles.everyone.setPermissions(guild.roles.everyone.permissions.remove('SendMessages', 'Connect'));
                
                // Try to notify the owner or a log channel
                const logRows = await conn.query('SELECT log_system_channel_id FROM guild_config WHERE guild_id = ?', [guild.id]);
                if (logRows.length > 0 && logRows[0].log_system_channel_id) {
                    const channel = guild.channels.cache.get(logRows[0].log_system_channel_id);
                    if (channel) {
                        const payload = createContainerMessage(
                            '⚠️ ANTİ-RAİD TETİKLENDİ ⚠️',
                            `Sunucuya son **${config.time_window} saniyede ${config.limit_count} üye** katıldığı için Anti-Raid koruması devreye girdi!\n\n**Olası bir bot saldırısı önlendi.** @everyone rolünün mesaj gönderme yetkisi gecici olarak kapatıldı.`,
                            '#ff0000'
                        );
                        await channel.send(payload).catch(()=>{});
                    }
                }
            } catch (e) {
                console.error("Anti-raid lockdown failed:", e);
            }
            
            // Auto unlock after 15 minutes (optional, could be manual)
            setTimeout(() => {
                guildData.locked = false;
            }, 15 * 60 * 1000);
        }
        
    } catch (err) {
        console.error('Anti-raid check error:', err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { handleAntiRaid };
