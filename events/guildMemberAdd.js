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
        let globalInviteCode = null;
        let globalInviteDuration = null;
        let globalInviteMaxUses = null;
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
                        globalInviteCode = inviteCode;
                        globalInviteDuration = usedInvite.maxAge;
                        globalInviteMaxUses = usedInvite.maxUses;
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
        
        if (shouldGiveAutorole) {
            try {
                const { getAutoroleConfig } = require('../utils/autoroleSystem');
                const aConfig = await getAutoroleConfig(member.guild.id);
                if (aConfig && (aConfig.is_enabled === 1 || aConfig.is_enabled === true)) {
                    let roleToAssign = null;
                    if (member.user.bot && aConfig.bot_role_id) {
                        roleToAssign = aConfig.bot_role_id;
                    } else if (!member.user.bot && aConfig.user_role_id) {
                        roleToAssign = aConfig.user_role_id;
                    } else if (autoroleId) {
                        roleToAssign = autoroleId;
                    }

                    if (roleToAssign) {
                        await member.roles.add(roleToAssign, 'Otomatik rol (Otorol) tanımlandı').catch(() => {});
                        
                        if (aConfig.channel_id) {
                            const notifyChan = member.guild.channels.cache.get(aConfig.channel_id);
                            if (notifyChan) {
                                const { buildModBResponse, MONO_EMOJIS } = require('../utils/uiBuilder');
                                const eUser = `<:mono:${MONO_EMOJIS.user || '1535662025232097504'}>`;
                                const payload = buildModBResponse({
                                    title: `${eUser} Otorol Verildi`,
                                    textLines: [
                                        `**Üye:** <@${member.id}> (${member.user.tag})`,
                                        `**Verilen Rol:** <@&${roleToAssign}>`,
                                        `**Tür:** ${member.user.bot ? 'Bot 🤖' : 'Kullanıcı 👤'}`
                                    ]
                                });
                                await notifyChan.send(payload).catch(() => {});
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Otorol işlemi hatası: ${err.message}`);
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

        // Karşılama (Welcome) Sistemi
        try {
            const { getWelcomeConfig } = require('../db');
            const { parseWelcomePlaceholders } = require('../utils/welcomeSystem');
            const { generateWelcomeCard } = require('../utils/welcomeCardGenerator');
            const { ContainerBuilder, TextDisplayBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');

            const welcomeCfg = await getWelcomeConfig(member.guild.id);
            const wChannelId = welcomeCfg?.welcome_channel_id || targetChannelId;

            let inviterUser = null;
            let inviterTotalCount = 0;
            if (globalInviter) {
                try {
                    inviterUser = await member.client.users.fetch(globalInviter).catch(() => null);
                    const invRows = await pool.query('SELECT COUNT(user_id) as count FROM invite_tracking WHERE guild_id = ? AND inviter_id = ?', [member.guild.id, globalInviter]);
                    inviterTotalCount = Number(invRows[0]?.count || 0);
                } catch (e) {}
            }

            // 1. DM Mesajı Gönder (Varsa)
            if (welcomeCfg?.welcome_dm_message) {
                const dmFormatted = parseWelcomePlaceholders(welcomeCfg.welcome_dm_message, member, inviterUser, inviterTotalCount, globalInviteCode, globalInviteDuration, globalInviteMaxUses);
                await member.send({ content: dmFormatted }).catch(() => {});
            }

            // 2. Kanala Mesaj Gönder
            if (wChannelId) {
                const channel = member.guild.channels.cache.get(wChannelId);
                if (channel) {
                    const rawMsg = welcomeCfg?.welcome_message || '{user} sunucumuza hoş geldin!';
                    const formattedMsg = parseWelcomePlaceholders(rawMsg, member, inviterUser, inviterTotalCount, globalInviteCode, globalInviteDuration, globalInviteMaxUses);

                    let files = [];
                    if (welcomeCfg?.welcome_gen_image) {
                        let fetchedUser = member.user;
                        try {
                            fetchedUser = await member.client.users.fetch(member.user.id, { force: true });
                        } catch (e) {
                            fetchedUser = member.user;
                        }

                        const avatarUrl = fetchedUser.displayAvatarURL({ extension: 'png', size: 256 });
                        const userFlags = fetchedUser.flags?.toArray() || [];
                        const isBooster = !!member.premiumSince || member.roles?.cache?.some(r => r.name.toLowerCase().includes('boost'));
                        const isOwner = member.guild?.ownerId === member.id;
                        const isBot = fetchedUser.bot;

                        const customCardHeader = welcomeCfg?.welcome_title 
                            ? parseWelcomePlaceholders(welcomeCfg.welcome_title, member, inviterUser, inviterTotalCount, globalInviteCode, globalInviteDuration, globalInviteMaxUses, true)
                            : null;
                        const customCardSubtitle = welcomeCfg?.welcome_message
                            ? parseWelcomePlaceholders(welcomeCfg.welcome_message, member, inviterUser, inviterTotalCount, globalInviteCode, globalInviteDuration, globalInviteMaxUses, true)
                            : `${member.guild.name} sunucusuna katıldın`;

                        const hasCountVariable = (welcomeCfg?.welcome_message && (welcomeCfg.welcome_message.includes('{count') || welcomeCfg.welcome_message.includes('{memberCount}'))) ||
                                                 (welcomeCfg?.welcome_title && (welcomeCfg.welcome_title.includes('{count') || welcomeCfg.welcome_title.includes('{memberCount}')));

                        const cardBuffer = await generateWelcomeCard({
                            avatarUrl,
                            username: fetchedUser.tag || fetchedUser.username,
                            customHeader: customCardHeader,
                            customSubtitle: customCardSubtitle,
                            guildName: member.guild.name,
                            memberCount: member.guild.memberCount,
                            type: 'welcome',
                            userFlags,
                            isBooster,
                            isOwner,
                            isBot,
                            showCountPill: !!hasCountVariable
                        });
                        if (cardBuffer) {
                            files.push(new AttachmentBuilder(cardBuffer, { name: 'welcome.png' }));
                        }
                    }

                    if (welcomeCfg?.welcome_plain_text) {
                        await channel.send({ content: formattedMsg, files }).catch(e => console.error("Welcome send error:", e));
                    } else {
                        const container = new ContainerBuilder();
                        if (welcomeCfg?.welcome_show_title !== false && welcomeCfg?.welcome_show_title !== 0) {
                            const title = welcomeCfg?.welcome_title 
                                ? parseWelcomePlaceholders(welcomeCfg.welcome_title, member)
                                : `Hoş Geldin, ${member.user.username}!`;
                            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
                        }
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(formattedMsg));

                        if (files.length > 0) {
                            const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
                            container.addMediaGalleryComponents(
                                new MediaGalleryBuilder().addItems(
                                    new MediaGalleryItemBuilder().setURL('attachment://welcome.png')
                                )
                            );
                        }

                        await channel.send({
                            components: [container],
                            files,
                            flags: MessageFlags.IsComponentsV2
                        }).catch(e => console.error("Welcome V2 send error:", e));
                    }
                }
            }
        } catch (welcomeErr) {
            console.error("Welcome dispatch error:", welcomeErr);
        }
    }
};
