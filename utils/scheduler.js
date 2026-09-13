const { initAutoPostScheduler } = require('./autopostScheduler');
const db = require('../db');
const { createContainerMessage } = require('./uiBuilder');

async function checkBirthdays(client) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const now = new Date();
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const configs = await conn.query("SELECT * FROM birthday_config WHERE channel_id IS NOT NULL");
        if (configs.length === 0) return;

        const users = await conn.query(
            "SELECT * FROM user_birthdays WHERE day = ? AND month = ? AND (announced_year IS NULL OR announced_year != ?)",
            [currentDay, currentMonth, currentYear]
        );

        for (const u of users) {
            const cfg = configs.find(c => c.guild_id === u.guild_id);
            if (!cfg) continue;

            const guild = client.guilds.cache.get(cfg.guild_id);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(cfg.channel_id);
            if (!channel) continue;

            const member = await guild.members.fetch(u.user_id).catch(() => null);
            if (!member) continue;

            let msg = cfg.message_template.replace(/{user}/g, `<@${u.user_id}>`);
            if (u.year) {
                const age = currentYear - u.year;
                msg = msg.replace(/{age}/g, age);
            } else {
                msg = msg.replace(/{age}/g, '');
            }

            const payload = createContainerMessage('Bugün Birinin Doğum Günü!', `<@${u.user_id}>\n\n${msg}`, '#FEE75C');
            await channel.send({ ...payload, flags: 16384 }).catch(() => {});

            if (cfg.temp_role_id) {
                await member.roles.add(cfg.temp_role_id).catch(() => {});
            }

            await conn.query("UPDATE user_birthdays SET announced_year = ? WHERE guild_id = ? AND user_id = ?", [currentYear, u.guild_id, u.user_id]);
        }
    } catch (e) {
        console.error('Birthday scheduler err:', e);
    } finally {
        if (conn) conn.release();
    }
}

async function checkPollDeadlines(client) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const polls = await conn.query("SELECT * FROM polls WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= NOW()");
        
        for (const p of polls) {
            await conn.query("UPDATE polls SET status = 'closed' WHERE id = ?", [p.id]);
            const { renderPollMessage } = require('./pollHandler');
            await renderPollMessage(client, conn, p);
        }
    } catch (e) {
        console.error('Poll scheduler err:', e);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Zamanı gelen hatırlatıcıları gönderir (DM veya kanal).
 * Yenilenen (recurring) kayıtlar bir sonraki zamanına taşınır.
 */
async function checkReminders(client) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const due = await conn.query(
            "SELECT * FROM reminders WHERE sent = FALSE AND remind_at <= NOW() ORDER BY remind_at ASC LIMIT 50"
        );
        if (due.length === 0) return;

        for (const r of due) {
            try {
                const { reminderButtons } = require('./reminderHandler');
                const payload = createContainerMessage(
                    'Hatırlatıcı',
                    `<@${r.user_id}>\n\n**Hatırlatma:**\n${r.message}`,
                    '#FEE75C',
                    reminderButtons(r.id)
                );

                if (r.is_dm) {
                    const user = await client.users.fetch(r.user_id).catch(() => null);
                    if (user) {
                        await user.send({ ...payload, flags: 16384 }).catch(() => {});
                    }
                } else {
                    const guild = client.guilds.cache.get(r.guild_id);
                    if (guild) {
                        const channel = guild.channels.cache.get(r.channel_id);
                        if (channel && channel.isTextBased()) {
                            await channel.send({ ...payload, flags: 16384 }).catch(() => {});
                        }
                    }
                }

                // Yenilenen hatırlatıcılar bir sonraki tarihe taşınır
                if (r.recurring === 'daily') {
                    await conn.query(
                        "UPDATE reminders SET remind_at = DATE_ADD(remind_at, INTERVAL 1 DAY), sent = FALSE WHERE id = ?",
                        [r.id]
                    );
                } else if (r.recurring === 'weekly') {
                    await conn.query(
                        "UPDATE reminders SET remind_at = DATE_ADD(remind_at, INTERVAL 7 DAY), sent = FALSE WHERE id = ?",
                        [r.id]
                    );
                } else {
                    await conn.query("UPDATE reminders SET sent = TRUE WHERE id = ?", [r.id]);
                }
            } catch (e) {
                console.error(`[Reminder #${r.id}] gönderim hatası:`, e.message);
                // Hata olsa bile tekrar denememesi için işaretle (spam önleme)
                await conn.query("UPDATE reminders SET sent = TRUE WHERE id = ?", [r.id]).catch(() => {});
            }
        }
    } catch (e) {
        console.error('Reminder scheduler err:', e);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Geri sayım kartlarını günceller (AYNI mesaj edit). Süresi dolanı kapatır.
 */
const geriMinCache = new Map();
async function checkCountdowns(client) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const rows = await conn.query("SELECT * FROM geri_sayim WHERE status = 'aktif' LIMIT 20");
        if (rows.length === 0) return;
        const { MessageFlags } = require('discord.js');
        for (const g of rows) {
            try {
                const kalan = Number(g.bitis) - Date.now();
                const guild = client.guilds.cache.get(g.guild_id);
                if (!guild) continue;
                const ch = guild.channels.cache.get(g.channel_id);
                if (!ch || !ch.isTextBased()) continue;
                const msg = g.message_id ? await ch.messages.fetch(g.message_id).catch(() => null) : null;
                if (!msg) {
                    await conn.query("UPDATE geri_sayim SET status='bitti' WHERE id = ?", [g.id]);
                    continue;
                }
                if (kalan <= 0) {
                    const payload = createContainerMessage(g.baslik, 'Süre doldu!', '#57F287');
                    await msg.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                    await conn.query("UPDATE geri_sayim SET status='bitti' WHERE id = ?", [g.id]);
                    geriMinCache.delete(g.id);
                    continue;
                }
                // Dakika değişmediyse edit yapma (rate-limit koruması)
                const mins = Math.ceil(kalan / 60000);
                if (geriMinCache.get(g.id) === mins) continue;
                geriMinCache.set(g.id, mins);
                const { fmtDuration } = require('./theme');
                const payload = createContainerMessage(g.baslik, `Kalan süre: **${fmtDuration(kalan)}**`, '#5865F2');
                await msg.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            } catch (e) {
                console.error(`[GeriSayım #${g.id}]:`, e.message);
            }
        }
    } catch (e) {
        console.error('[GeriSayım] scheduler:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Süresi dolan tempbanları kaldırır.
 */
async function checkTempbans(client) {
    let conn;
    try {
        conn = await db.pool.getConnection();
        const rows = await conn.query('SELECT * FROM tempbans WHERE expires_at <= ?', [Date.now()]);
        for (const t of rows) {
            try {
                const guild = client.guilds.cache.get(t.guild_id);
                if (guild) await guild.bans.remove(t.user_id, 'Süreli ban bitti').catch(() => {});
                await conn.query('DELETE FROM tempbans WHERE guild_id = ? AND user_id = ?', [t.guild_id, t.user_id]);
            } catch (e) {
                console.error(`[Tempban ${t.user_id}]:`, e.message);
            }
        }
    } catch (e) {
        console.error('[Tempban] scheduler:', e.message);
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Sosyal medya (YouTube/Twitch/Kick) yeni içerik bildirimlerini tarar.
 */
async function checkSocialAlerts(client) {
    try {
        const { checkSocialAlerts: poll } = require('./socialPoller');
        await poll(client);
    } catch (e) {
        console.error('Social poller err:', e);
    }
}

function initScheduler(client) {
    console.log('[Scheduler] Merkezi zamanlayıcı başlatılıyor (tek döngü + açılışta kaçırılan işler)...');
    initAutoPostScheduler(client);

    let running = false;
    async function runScheduledJobs(reason) {
        if (running) return;
        running = true;
        try {
            // Sıra önemli: anket kapatma önce (mesaj editi), sonra hatırlatıcı, doğum günü, sosyal
            await checkPollDeadlines(client).catch(e => console.error('[Scheduler] poll:', e.message));
            await checkReminders(client).catch(e => console.error('[Scheduler] reminder:', e.message));
            await checkBirthdays(client).catch(e => console.error('[Scheduler] birthday:', e.message));
            await checkSocialAlerts(client).catch(e => console.error('[Scheduler] social:', e.message));
        } finally {
            running = false;
        }
    }

    // Açılışta kaçırılan işleri hemen işle (restart sonrası sent=FALSE + zamanı geçmiş)
    setTimeout(() => runScheduledJobs('boot-catchup'), 15000);

    // Tek merkezi döngü: her 60sn'de tüm işler (duplicate mesaj riski yok — tek process, tek timer)
    setInterval(() => runScheduledJobs('tick-60s'), 60 * 1000);
    // Hatırlatıcılar için ek hızlı tur (30sn) — sadece reminder kontrol eder, diğerlerini tekrar etmez
    setInterval(() => checkReminders(client).catch(() => {}), 30 * 1000);
    // Geri sayım + tempban hızlı turu (30sn)
    setInterval(() => { checkCountdowns(client).catch(() => {}); checkTempbans(client).catch(() => {}); }, 30 * 1000);
    // Doğum günü saatlik yeterlidir (günde 1 kez kutlama)
    setInterval(() => checkBirthdays(client).catch(() => {}), 60 * 60 * 1000);

    console.log('[Scheduler] Modüller zamanlandı (merkezi).');
}

module.exports = { initScheduler, checkCountdowns, checkTempbans, checkReminders, checkBirthdays, checkPollDeadlines };
