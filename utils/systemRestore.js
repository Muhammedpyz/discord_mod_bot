const db = require('../db');

/**
 * Bot yeniden başladığında yarım kalan veya aktif olan sistemleri kaldığı yerden devam ettirir.
 */
async function restoreSystemState(client) {
    console.log('[Sistem Kurtarma] Bot başlangıç durumu taranıyor ve geri yükleniyor...');

    // 1. Ses XP Sayaçlarını Kurtarma
    try {
        if (!client.voiceXpTimers) {
            client.voiceXpTimers = new Map();
        }

        let voiceUsersCount = 0;
        const now = Date.now();

        for (const guild of client.guilds.cache.values()) {
            const afkChannelId = guild.afkChannelId;

            for (const channel of guild.channels.cache.values()) {
                if (channel.isVoiceBased() && channel.id !== afkChannelId) {
                    for (const member of channel.members.values()) {
                        if (member.user.bot) continue;

                        // Kulaklığı kapalı (sağır) olanlar muaf
                        const isDeaf = member.voice.selfDeaf || member.voice.serverDeaf;
                        if (!isDeaf) {
                            const timerKey = `${guild.id}_${member.id}`;
                            client.voiceXpTimers.set(timerKey, now);
                            voiceUsersCount++;
                        }
                    }
                }
            }
        }
        console.log(`[Sistem Kurtarma] ${voiceUsersCount} aktif sesli üyenin XP sayacı kaldığı yerden devam ettirildi.`);
    } catch (e) {
        console.error('[Sistem Kurtarma] Ses XP sayaçları kurtarılamadı:', e.message);
    }

    // 2. Özel Odaları (Active Rooms) Kurtarma ve Temizleme
    try {
        const pool = db.pool;
        if (pool) {
            const conn = await pool.getConnection();
            try {
                const rows = await conn.query('SELECT * FROM active_rooms');
                let cleanedRooms = 0;

                for (const room of rows) {
                    const guild = client.guilds.cache.get(room.guild_id);
                    if (!guild) {
                        await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [room.channel_id]);
                        cleanedRooms++;
                        continue;
                    }

                    const voiceChan = guild.channels.cache.get(room.channel_id);
                    if (!voiceChan) {
                        // Kanal Discord'dan silinmiş, DB'den de temizle
                        await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [room.channel_id]);
                        cleanedRooms++;
                    } else if (voiceChan.members.size === 0) {
                        // Oda boş, 60 saniye sonra sil
                        setTimeout(async () => {
                            try {
                                const currentChan = guild.channels.cache.get(room.channel_id);
                                if (currentChan && currentChan.members.size === 0) {
                                    await currentChan.delete().catch(() => {});
                                    await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [room.channel_id]);
                                }
                            } catch (err) {}
                        }, 60000);
                    }
                }
                if (cleanedRooms > 0) {
                    console.log(`[Sistem Kurtarma] ${cleanedRooms} geçersiz/kapanmış özel oda veritabanından temizlendi.`);
                }
            } finally {
                conn.release();
            }
        }
    } catch (e) {
        console.error('[Sistem Kurtarma] Özel odalar kurtarılamadı:', e.message);
    }

    console.log('[Sistem Kurtarma] Tüm sistem durumları başarıyla eşitlendi.');
}

module.exports = {
    restoreSystemState
};
