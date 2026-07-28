const { Events } = require('discord.js');
const { createModActionButtons } = require('../utils/embeds');
const { createV2Message, createContainerMessage, COLORS } = require('../utils/uiBuilder');
const { pool, getGuildConfig } = require('../db');
const { sendLog } = require('../utils/logger');

const joinCache = new Map();

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        if (!member.guild) return;

        const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        const isSuspicious = accountAgeDays < 7;
        
        let dbLogChannelId = null;
        let config;
        
        try {
            config = await getGuildConfig(member.guild.id);
            if (config) {
                dbLogChannelId = config.log_channel_id;
            }
        } catch (e) {
            console.error("Config hatasi guildMemberAdd:", e);
        }

        const now = Date.now();
        const guildId = member.guild.id;
        
        if (!joinCache.has(guildId)) {
            joinCache.set(guildId, []);
        }
        
        const joins = joinCache.get(guildId);
        const recentJoins = joins.filter(timestamp => now - timestamp < 10000);
        recentJoins.push(now);
        joinCache.set(guildId, recentJoins);
        
        let raidDetected = recentJoins.length >= 10;
        
        if (raidDetected) {
            try {
                await member.kick('Sistem Koruması: Çok hızlı katılım tespiti');
                
                if (dbLogChannelId && recentJoins.length === 10) { 
                    const payload = createV2Message({
                        title: 'Sistem Koruması Devrede',
                        description: 'Kısa sürede çok fazla üye katılımı tespit edildi. Yeni hesaplar otomatik olarak uzaklaştırılıyor.',
                        color: COLORS.ERROR
                    });
                    await sendLog(member.guild, payload).catch(()=>{});
                }
            } catch (e) {
                console.error("Raid kick hatası", e);
            }
            return;
        }

        if (isSuspicious && dbLogChannelId) {
            const channel = member.guild.channels.cache.get(dbLogChannelId);
            if (channel) {
                const buttons = createModActionButtons(member.id);
                const payload = createV2Message({
                    title: 'Yeni Hesap Katılımı',
                    description: `**Kullanıcı:** ${member.user.tag} (${member.id})\n**Yetkili:** Sistem\n**Sebep:** Hesap ${Math.round(accountAgeDays)} gün önce açılmış. Şüpheli durum olabilir.`,
                    color: COLORS.WARNING,
                    actionRows: [buttons]
                });
                await sendLog(member.guild, payload).catch(()=>{});
            }
        }

        let targetChannelId = null;
        let autoroleId = null;
        if (config) {
            targetChannelId = config.welcome_channel_id;
            autoroleId = config.autorole_id;
        }

        let conn2;
        try {
            conn2 = await pool.getConnection();
            await conn2.query(`
                INSERT INTO members (user_id, username, is_in_guild, last_join)
                VALUES (?, ?, TRUE, NOW())
                ON DUPLICATE KEY UPDATE username = ?, is_in_guild = TRUE, last_join = NOW()
            `, [member.id, member.user.username, member.user.username]);
        } catch (err) {
            console.error("Member insert error:", err);
        } finally {
            if (conn2) conn2.release();
        }
        
        if (autoroleId) {
            try {
                await member.roles.add(autoroleId, 'Sunucuya katılım otorol işlemi');
            } catch (err) {
                console.error(`Otorol verilemedi: ${err.message}`);
            }
        }

        let connMute;
        try {
            connMute = await pool.getConnection();
            const activeMutes = await connMute.query(
                'SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
                [member.guild.id, member.id]
            );

            if (activeMutes.length > 0 && config) {
                for (const m of activeMutes) {
                    if (m.action_type === 'text_mute' && config.text_mute_role_id) {
                        await member.roles.add(config.text_mute_role_id, 'Kısıtlama İhlali Koruması: Aktif cezası tekrar yüklendi').catch(() => {});
                        if (m.expires_at) {
                            const remainingMs = new Date(m.expires_at).getTime() - Date.now();
                            if (remainingMs > 0) await member.timeout(remainingMs, 'Kısıtlama İhlali Koruması').catch(() => {});
                        }
                    } else if (m.action_type === 'voice_mute' && config.voice_mute_role_id) {
                        await member.roles.add(config.voice_mute_role_id, 'Ses Kısıtlama İhlali Koruması').catch(() => {});
                    }
                }

                if (dbLogChannelId) {
                    const payload = createV2Message({
                        title: 'Cezasız Ayrılış Engellendi',
                        description: `<@${member.id}> kullanıcısının aktif cezası devam ettiği için kısıtlama rolü otomatik olarak tekrar yüklendi.`,
                        color: COLORS.ERROR
                    });
                    await sendLog(member.guild, payload).catch(()=>{});
                }
            }
        } catch (e) {
            console.error('Mute Evasion Error:', e);
        } finally {
            if (connMute) connMute.release();
        }

        if (targetChannelId) {
            const channel = member.guild.channels.cache.get(targetChannelId);
            if (channel) {
                const welcomeMessages = [
                    "Aramıza hoş geldin {user}. Katılımınla daha güçlüyüz.",
                    "Merhaba {user}, sunucuya giriş yaptın. Kuralları okumayı unutma.",
                    "Hoş geldin {user}. Seninle birlikte büyümeye devam ediyoruz.",
                    "Sunucumuza katıldığın için teşekkürler {user}.",
                    "{user} aramıza katıldı. Hoş geldin."
                ];
                const randomMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{user}', `<@${member.id}>`);
                
                const payload = createV2Message({
                    title: 'Sunucuya Katılım',
                    description: `<@${member.id}>\n\n**${randomMsg}**\n\nSeninle beraber toplam **${member.guild.memberCount}** kişi olduk.`,
                    color: COLORS.SUCCESS
                });
                
                await channel.send(payload).catch(e => console.error("Welcome mesaj hatasi", e));
            }
        }
    }
};
