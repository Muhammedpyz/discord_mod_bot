const { pool, getGuildConfig } = require('../db');
const { sendLog } = require('./logger');
const { createV2Message, COLORS } = require('./uiBuilder');

async function checkExpiredMutes(client) {
    let conn;
    try {
        conn = await pool.getConnection();

        const expiredMutes = await conn.query(
            'SELECT * FROM mutes WHERE is_active = TRUE AND expires_at IS NOT NULL AND expires_at <= NOW()'
        );

        for (const record of expiredMutes) {
            try {
                const guild = client.guilds.cache.get(record.guild_id);
                if (guild) {
                    const config = await getGuildConfig(guild.id);
                    const member = await guild.members.fetch(record.user_id).catch(() => null);

                    if (member && config) {
                        if (record.action_type === 'text_mute' && config.text_mute_role_id) {
                            await member.roles.remove(config.text_mute_role_id).catch(() => {});
                            await member.timeout(null).catch(() => {});
                        } else if (record.action_type === 'voice_mute' && config.voice_mute_role_id) {
                            await member.roles.remove(config.voice_mute_role_id).catch(() => {});
                        }

                        const payload = createV2Message({
                            title: 'Kısıtlama Süresi Doldu',
                            description: `<@${member.id}> adlı kullanıcının susturulma süresi sona ermiş ve kısıtlamaları kaldırılmıştır.`,
                            color: COLORS.SUCCESS
                        });

                        await sendLog(guild, payload).catch(()=>{});
                    }
                }
            } catch (err) {
                console.error(`MuteChecker kayit işleme hatası ID ${record.id}:`, err);
            }

            await conn.query('UPDATE mutes SET is_active = FALSE WHERE id = ?', [record.id]).catch(e => console.error("MuteChecker DB guncelleme hatası", e));
        }
    } catch (error) {
        console.error('MuteChecker genel hatası:', error);
    } finally {
        if (conn) conn.release();
    }
}

let isRunning = false;
function startMuteChecker(client, intervalMs = 30000) {
    setInterval(async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            await checkExpiredMutes(client);
        } finally {
            isRunning = false;
        }
    }, intervalMs);
}

module.exports = { startMuteChecker };
