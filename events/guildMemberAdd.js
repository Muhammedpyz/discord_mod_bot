const { Events } = require('discord.js');
const { createModActionButtons } = require('../utils/embeds');
const { createV2Message, createContainerMessage, COLORS } = require('../utils/uiBuilder');
const { pool, getGuildConfig } = require('../db');
const { sendLog } = require('../utils/logger');

const joinCache = new Map();
const inviteFetchLocks = new Map();

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
            console.error("Config hatası guildMemberAdd:", e);
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
                    await sendLog(member.guild, payload, 'system').catch(()=>{});
                }
            } catch (e) {
                console.error("Raid kick hatası", e);
            }
            return;
        }

        if (dbLogChannelId) {
            const channel = member.guild.channels.cache.get(dbLogChannelId);
            if (channel) {
                const buttons = createModActionButtons(member.id);
                
                const creationDate = member.user.createdAt.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const ageDays = Math.round(accountAgeDays);
                
                let badges = 'Yok';
                if (member.user.flags && member.user.flags.toArray().length > 0) {
                    badges = member.user.flags.toArray().join(', ').replace(/HypeSquadOnlineHouse1/g, 'Bravery').replace(/HypeSquadOnlineHouse2/g, 'Brilliance').replace(/HypeSquadOnlineHouse3/g, 'Balance').replace(/PremiumEarlySupporter/g, 'Erken Destekçi').replace(/ActiveDeveloper/g, 'Aktif Geliştirici');
                }
                
                let riskText = isSuspicious ? '**RİSKLİ (7 günden yeni hesap)**' : 'Güvenli (Eski Hesap)';
                let colorToUse = isSuspicious ? COLORS.ERROR : COLORS.INFO;

                const payload = createV2Message({
                    title: 'Giriş: Detaylı Kullanıcı Raporu',
                    description: `**Kullanıcı:** <@${member.id}>\n**Kullanıcı Adı:** \`${member.user.tag}\`\n**ID:** \`${member.id}\`\n\n**Hesap Türü:** ${member.user.bot ? 'Bot 🤖' : 'İnsan 👤'}\n**Hesap Kuruluş Tarihi:** ${creationDate} (${ageDays} gün önce)\n**Rozetleri (Badges):** ${badges}\n\n**Güvenlik Durumu:** ${riskText}`,
                    color: colorToUse,
                    thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
                    actionRows: [buttons]
                });
                await sendLog(member.guild, payload, 'system').catch(()=>{});
            }
        }

        let targetChannelId = null;
        let autoroleId = null;
        if (config) {
            targetChannelId = config.welcome_channel_id;
            autoroleId = config.autorole_id;
        }

        let conn2;
        let isMuted = false;
        let activeWarnsCount = 0;
        let globalInviter = null;
        try {
            conn2 = await pool.getConnection();
            
            const muteRows = await conn2.query('SELECT id FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [member.guild.id, member.id]);
            if (muteRows.length > 0) isMuted = true;
            
            const warnRows = await conn2.query('SELECT COUNT(id) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [member.guild.id, member.id]);
            activeWarnsCount = Number(warnRows[0]?.count || 0);
            
            let inviter = null;
            let inviteCode = null;
            if (client.invites && client.invites.has(member.guild.id)) {
                try {
                    const cachedInvites = client.invites.get(member.guild.id);
                    let newInvites;
                    if (inviteFetchLocks.has(member.guild.id)) {
                        newInvites = await inviteFetchLocks.get(member.guild.id);
                    } else {
                        const fetchPromise = member.guild.invites.fetch().finally(() => {
                            setTimeout(() => inviteFetchLocks.delete(member.guild.id), 2000);
                        });
                        inviteFetchLocks.set(member.guild.id, fetchPromise);
                        newInvites = await fetchPromise;
                    }
                    const usedInvite = newInvites.find(inv => {
                        const cachedUses = cachedInvites.get(inv.code) || 0;
                        return inv.uses > cachedUses;
                    });
                    
                    if (usedInvite) {
                        inviter = usedInvite.inviterId;
                        inviteCode = usedInvite.code;
                        globalInviter = inviter;
                        for (const [code, inv] of newInvites) {
                            cachedInvites.set(code, inv.uses);
                        }
                    }
                } catch (e) {}
            }

            await conn2.query(`
                INSERT INTO members (user_id, username, is_in_guild, last_join)
                VALUES (?, ?, TRUE, NOW())
                ON DUPLICATE KEY UPDATE username = ?, is_in_guild = TRUE, last_join = NOW()
            `, [member.id, member.user.username, member.user.username]);

            if (inviter) {
                try { await conn2.query('ALTER TABLE invite_tracking ADD COLUMN invite_code VARCHAR(25)'); } catch(e){}
                try { await conn2.query('ALTER TABLE invite_tracking ADD COLUMN is_fake BOOLEAN DEFAULT FALSE'); } catch(e){}
                await conn2.query(`
                    INSERT INTO invite_tracking (guild_id, user_id, inviter_id, invite_code, is_fake, joined_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE inviter_id = ?, invite_code = ?, is_fake = ?, joined_at = NOW()
                `, [member.guild.id, member.id, inviter, inviteCode, isSuspicious, inviter, inviteCode, isSuspicious]);
            }
        } catch (err) {
            console.error("Member DB check/insert error:", err);
        } finally {
            if (conn2) conn2.release();
        }
        
        let shouldGiveAutorole = true;
        
        if (isMuted && config) {
            shouldGiveAutorole = false;
            try {
                let rolesAdded = 0;
                if (config.text_mute_role_id) { await member.roles.add(config.text_mute_role_id, 'Sistem Koruması: Mute cezasından kaçma girişimi engellendi').catch(()=>{}); rolesAdded++; }
                if (config.voice_mute_role_id) { await member.roles.add(config.voice_mute_role_id, 'Sistem Koruması: Mute cezasından kaçma girişimi engellendi').catch(()=>{}); rolesAdded++; }
                
                if (rolesAdded > 0 && dbLogChannelId) {
                    const payload = createV2Message({
                        title: 'Mute Cezasından Kaçma Girişimi',
                        description: `**Kullanıcı:** ${member.user.tag} (<@${member.id}>)\nKullanıcı aktif bir susturma cezası varken sunucudan çıkıp tekrar girdi. Cezalı rolleri otomatik olarak geri verildi.`,
                        color: COLORS.WARNING
                    });
                    await sendLog(member.guild, payload, 'system').catch(()=>{});
                }
            } catch(e) { console.error("Mute rol geri verme hatası:", e); }
        }
        
        if (activeWarnsCount > 0 && config) {
            try {
                let roleToGive = null;
                if (activeWarnsCount === 1) roleToGive = config.warn1_role_id;
                else if (activeWarnsCount === 2) roleToGive = config.warn2_role_id;
                else if (activeWarnsCount >= 3) {
                    roleToGive = config.banned_role_id;
                    shouldGiveAutorole = false;
                }
                
                if (roleToGive) {
                    await member.roles.add(roleToGive, 'Sistem Koruması: Uyarı cezası/rolü hafızadan geri yüklendi').catch(()=>{});
                    if (dbLogChannelId) {
                        const payload = createV2Message({
                            title: 'Cezalı Kullanıcı Girişi (Uyarı)',
                            description: `**Kullanıcı:** ${member.user.tag} (<@${member.id}>)\nKullanıcının veritabanında aktif **${activeWarnsCount}** uyarısı bulunuyor. Sahip olması gereken ceza/uyarı rolü tekrar tanımlandı.`,
                            color: COLORS.WARNING
                        });
                        await sendLog(member.guild, payload, 'system').catch(()=>{});
                    }
                }
            } catch(e) { console.error("Warn rol geri verme hatası:", e); }
        }
        
        if (autoroleId && shouldGiveAutorole) {
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
                    await sendLog(member.guild, payload, 'system').catch(()=>{});
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
                
                let inviteText = '';
                if (globalInviter) inviteText = `\n**Davet Eden:** <@${globalInviter}>`;

                const payload = createV2Message({
                    title: 'Sunucuya Katılım',
                    description: `<@${member.id}>\n\n**${randomMsg}**${inviteText}\n\nSeninle beraber toplam **${member.guild.memberCount}** kişi olduk.`,
                    color: COLORS.SUCCESS
                });

                await channel.send(payload).catch(e => console.error("Welcome mesaj hatası", e));
            }
        }
    }
};
