const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } = require('discord.js');
const { pool } = require('../db');
const { createV2Message, createContainerMessage, createV2Container, COLORS } = require('./uiBuilder');
const config = require('../config.json');

async function checkTicketLimits(guildId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        
        const countQuery = await conn.query(
            `SELECT COUNT(*) as count FROM ticket_logs WHERE guild_id = ? AND user_id = ? AND created_at > NOW() - INTERVAL 1 DAY`,
            [guildId, userId]
        );
        const ticketsToday = Number(countQuery[0].count);

        const lastTicketQuery = await conn.query(
            `SELECT created_at FROM ticket_logs WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
            [guildId, userId]
        );
        
        let cooldownRemaining = 0;
        if (lastTicketQuery.length > 0) {
            const lastTime = new Date(lastTicketQuery[0].created_at).getTime();
            const now = Date.now();
            const hourInMs = 60 * 60 * 1000;
            
            if (now - lastTime < hourInMs) {
                cooldownRemaining = hourInMs - (now - lastTime);
            }
        }

        return { ticketsToday, cooldownRemaining };
    } catch (err) {
        console.error("Bilet limit kontrol hatası:", err);
        return { ticketsToday: 0, cooldownRemaining: 0 };
    } finally {
        if (conn) conn.release();
    }
}

async function createTicket(interaction, reason, category = 'Diğer') {
    let conn;
    let configObj = null;

    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT ticket_role_id, ticket_category_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
        if (rows.length > 0) configObj = rows[0];
    } catch (err) {
        console.error("Config fetch hatası:", err);
    } finally {
        if (conn) conn.release();
    }

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!isAdmin) {
        const { ticketsToday, cooldownRemaining } = await checkTicketLimits(interaction.guild.id, interaction.user.id);

        if (ticketsToday >= 3) {
            return interaction.reply({ content: 'Günlük bilet açma sınırınıza ulaştınız. Lütfen yarın tekrar deneyin.', flags: MessageFlags.Ephemeral });
        }

        if (cooldownRemaining > 0) {
            const minutes = Math.ceil(cooldownRemaining / (60 * 1000));
            return interaction.reply({ content: `Yeni bir destek talebi açmadan önce lütfen **${minutes} dakika** daha bekleyin.`, flags: MessageFlags.Ephemeral });
        }
    }

    await interaction.reply({ content: 'Talebiniz oluşturuluyor...', flags: MessageFlags.Ephemeral }).catch(()=>{});

    const permissionOverwrites = [
        {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
        },
        {
            id: interaction.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]
        }
    ];

    let pingText = `<@${interaction.user.id}>`;

    if (configObj && configObj.ticket_role_id) {
        const roles = configObj.ticket_role_id.split(',');
        for (const role of roles) {
            permissionOverwrites.push({
                id: role,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            });
            pingText = `<@&${role}> ` + pingText;
        }
    }

    const channelData = {
        name: `destek-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: permissionOverwrites
    };

    let catId = configObj ? configObj.ticket_category_id : null;
    let cat = catId ? interaction.guild.channels.cache.get(catId) : null;
    
    if (!cat || cat.type !== ChannelType.GuildCategory) {
        try {
            cat = await interaction.guild.channels.create({
                name: 'DESTEK TALEPLERI',
                type: ChannelType.GuildCategory
            });
            let conn2;
            try {
                conn2 = await pool.getConnection();
                await conn2.query('UPDATE guild_config SET ticket_category_id = ? WHERE guild_id = ?', [cat.id, interaction.guild.id]);
            } catch(e){} finally { if (conn2) conn2.release(); }
        } catch (e) {
            console.error("Ticket kategori oluşturulamadı:", e);
        }
    }
    
    if (cat) {
        channelData.parent = cat.id;
    }

    try {
        const ticketChannel = await interaction.guild.channels.create(channelData);

        try {
            conn = await pool.getConnection();
            await conn.query('INSERT INTO ticket_logs (guild_id, user_id) VALUES (?, ?)', [interaction.guild.id, interaction.user.id]);
            
            await conn.query(
                'INSERT INTO tickets (guild_id, channel_id, owner_id, owner_tag, category, reason) VALUES (?, ?, ?, ?, ?, ?)',
                [interaction.guild.id, ticketChannel.id, interaction.user.id, interaction.user.tag, category, reason]
            );
        } catch(e) {
            console.error("DB bilet kayıt hatası:", e);
        } finally {
            if (conn) conn.release();
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket:close:${ticketChannel.id}`).setLabel('Talebi Kapat').setStyle(ButtonStyle.Danger)
        );

        const payload = createV2Container({
            title: `Destek Talebi: ${interaction.user.tag}`,
            description: `${pingText}\n\n**Talep Sebebi:**\n${reason}\n\nLütfen sorununuzu detaylı bir şekilde anlatıp yetkililerin yanıt vermesini bekleyin. Cezaya itiraz ediyorsanız kanıt sunmayı unutmayın.`,
            color: COLORS.TICKET,
            fields: []
        });
        
        payload.components = [row];

        await ticketChannel.send(payload).catch(e => console.error("Kanal mesaj hatası", e));
        await interaction.editReply({ content: `Talebiniz başarıyla oluşturuldu: <#${ticketChannel.id}>` }).catch(()=>{});

        if (configObj) {
            const isTicketLogSet = !!configObj.log_ticket_channel_id;
            const targetChannelId = configObj.log_ticket_channel_id || configObj.log_channel_id;
            
            if (targetChannelId) {
                const logChannel = interaction.guild.channels.cache.get(targetChannelId);
                if (logChannel) {
                    const fields = [
                        { name: 'Kullanıcı', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                        { name: 'Kategori', value: `${category}`, inline: true },
                        { name: 'Kanal', value: `<#${ticketChannel.id}>`, inline: true }
                    ];
                    let desc = `**Yeni bir destek talebi (ticket) açıldı.**\n\n**Talep Sebebi:**\n${reason}`;
                    
                    const openLogPayload = createContainerMessage(
                        'Bilet Açıldı',
                        desc,
                        '#3498db',
                        [], fields
                    );
                    logChannel.send(openLogPayload).catch(()=>{});
                }
            }
        }

        if (configObj && configObj.ticket_role_id) {
            const adminRoles = configObj.ticket_role_id.split(',');
            try {
                const members = await interaction.guild.members.fetch({ withPresences: true });
                
                const activeAdmins = members.filter(m => {
                    if (m.user.bot) return false;
                    const hasRole = adminRoles.some(rId => m.roles.cache.has(rId));
                    const isOnline = m.presence && ['online', 'idle', 'dnd'].includes(m.presence.status);
                    return hasRole && isOnline;
                });

                const dmPayload = createV2Message({
                    title: 'Yeni Bilet Oluşturuldu',
                    description: `Sunucuda **${interaction.user.tag}** yeni bir destek talebi açtı.\n\n**Kanal:** <#${ticketChannel.id}>\n**Kategori:** ${category}\n\nBu mesaj aktif olduğunuz için iletilmiştir.`,
                    color: COLORS.INFO
                });

                const targetAdmins = Array.from(activeAdmins.values()).slice(0, 5);

                targetAdmins.forEach((admin, idx) => {
                    setTimeout(() => {
                        admin.send(dmPayload).catch(() => {});
                    }, idx * 500);
                });
            } catch (err) {
                console.error("Yetkililere DM atılırken hata:", err);
            }
        }
    } catch (err) {
        console.error("Bilet kanalı oluşturma hatası:", err);
        await interaction.editReply({ content: 'Kanal oluşturulurken bir hata meydana geldi. İşlem yetkilerimi kontrol edin.' }).catch(()=>{});
    }
}

async function closeTicketChannel(interaction) {
    let conn;
    let canClose = false;
    try {
        conn = await pool.getConnection();
        const [tRows] = await conn.query('SELECT owner_id FROM tickets WHERE channel_id = ?', [interaction.channel.id]);
        const isOwner = tRows.length > 0 && tRows[0].owner_id === interaction.user.id;
        const isSuperAdmin = require('./systemNode').checkSystemNode(interaction.user.id);
        const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
        
        const [gConfig] = await conn.query('SELECT ticket_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
        let isStaff = false;
        if (gConfig.length > 0 && gConfig[0].ticket_role_id) {
            const staffRoles = gConfig[0].ticket_role_id.split(',');
            isStaff = interaction.member.roles.cache.some(r => staffRoles.includes(r.id));
        }

        canClose = isOwner || isStaff || hasManageChannels || isSuperAdmin;
    } catch(e) {
        canClose = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || require('./systemNode').checkSystemNode(interaction.user.id);
    } finally {
        if (conn) conn.release();
    }

    if (!canClose) {
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({ content: 'Sadece bilet sahibi veya yetkililer bu talebi kapatabilir.', flags: MessageFlags.Ephemeral }).catch(()=>{});
        }
        return interaction.reply({ content: 'Sadece bilet sahibi veya yetkililer bu talebi kapatabilir.', flags: MessageFlags.Ephemeral }).catch(()=>{});
    }

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Bilet günlüğü oluşturuluyor ve kanal 5 saniye içinde kapatılıp silinecektir...' }).catch(()=>{});
    } else {
        await interaction.reply({ content: 'Bilet günlüğü oluşturuluyor ve kanal 5 saniye içinde kapatılıp silinecektir...' }).catch(()=>{});
    }

    try {
        const { generateDiscordTranscriptHtml } = require('./discordHtmlExporter');
        
        let liveMessages = [];
        let lastId;
        while (true) {
            const fetchOpts = { limit: 100 };
            if (lastId) fetchOpts.before = lastId;
            const fetchedMsgs = await interaction.channel.messages.fetch(fetchOpts);
            if (fetchedMsgs.size === 0) break;
            liveMessages.push(...fetchedMsgs.values());
            lastId = fetchedMsgs.last().id;
            if (fetchedMsgs.size < 100) break;
        }

        let ticketData = null;
        let dbMessages = [];
        try {
            conn = await pool.getConnection();
            const [tRows] = await conn.query('SELECT * FROM tickets WHERE channel_id = ?', [interaction.channel.id]);
            if (tRows.length > 0) ticketData = tRows[0];

            dbMessages = await conn.query('SELECT * FROM ticket_messages WHERE channel_id = ? ORDER BY created_at ASC', [interaction.channel.id]);
        } catch (e) {
            console.error("DB Ticket query error:", e);
        } finally {
            if (conn) conn.release();
        }

        const messageMap = new Map();

        // 1. Live channel messages
        for (const msg of liveMessages) {
            messageMap.set(msg.id, {
                id: msg.id,
                author: msg.author,
                author_tag: msg.author ? msg.author.tag : 'Kullanıcı',
                author_avatar: msg.author ? msg.author.displayAvatarURL({ size: 128, extension: 'png' }) : '',
                content: msg.content || '',
                createdTimestamp: msg.createdTimestamp,
                attachments: msg.attachments,
                embeds: msg.embeds,
                is_deleted: false,
                is_edited: false
            });
        }

        // 2. DB messages (includes deleted/edited)
        if (dbMessages && dbMessages.length > 0) {
            for (const dbMsg of dbMessages) {
                const msgId = dbMsg.message_id || `db_${dbMsg.id}`;
                if (messageMap.has(msgId)) {
                    const existing = messageMap.get(msgId);
                    if (dbMsg.is_deleted) existing.is_deleted = true;
                    if (dbMsg.is_edited) {
                        existing.is_edited = true;
                        existing.old_content = dbMsg.old_content;
                        existing.edited_content = dbMsg.edited_content;
                    }
                } else {
                    messageMap.set(msgId, {
                        id: msgId,
                        author: { username: dbMsg.author_tag ? dbMsg.author_tag.split('#')[0] : 'Kullanıcı', tag: dbMsg.author_tag || 'Kullanıcı', bot: false },
                        author_tag: dbMsg.author_tag || 'Kullanıcı',
                        author_avatar: dbMsg.author_avatar || '',
                        content: dbMsg.content || '',
                        createdTimestamp: dbMsg.created_at ? new Date(dbMsg.created_at).getTime() : Date.now(),
                        attachments_json: dbMsg.attachments_json,
                        embeds_json: dbMsg.embeds_json,
                        is_deleted: Boolean(dbMsg.is_deleted),
                        is_edited: Boolean(dbMsg.is_edited),
                        old_content: dbMsg.old_content,
                        edited_content: dbMsg.edited_content
                    });
                }
            }
        }

        const allMessages = Array.from(messageMap.values());
        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        const htmlStr = await generateDiscordTranscriptHtml({
            guild: interaction.guild,
            channel: interaction.channel,
            messages: allMessages,
            ticketData
        });

        const ticketNum = ticketData ? ticketData.id : 'log';
        const attachmentHtml = new AttachmentBuilder(Buffer.from(htmlStr, 'utf-8'), { name: `ticket-#${ticketNum}-${interaction.channel.name}.html` });
        
        let textTranscript = `Bilet Günlüğü - ${interaction.channel.name}\n`;
        textTranscript += `Kapanma Tarihi: ${new Date().toISOString()}\n`;
        textTranscript += '='.repeat(60) + '\n\n';
        for (const msg of allMessages) {
            const rawTs = msg.createdTimestamp || (msg.created_at ? new Date(msg.created_at).getTime() : Date.now());
            const validTs = isNaN(rawTs) ? Date.now() : rawTs;
            const dateStr = new Date(validTs).toISOString().replace('T', ' ').substring(0, 16);
            const authorTag = msg.author_tag || (msg.author ? msg.author.tag : 'Kullanıcı');
            textTranscript += `[${dateStr}] ${authorTag}: ${msg.content || ''}\n`;
            if (msg.attachments && msg.attachments.size > 0) {
                msg.attachments.forEach(att => {
                    const ext = att.name ? att.name.split('.').pop().toLowerCase() : '';
                    let typeTag = 'Ek Dosya';
                    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) typeTag = 'Görsel';
                    else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) typeTag = 'Ses/Sesli Mesaj';
                    else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) typeTag = 'Video';
                    
                    textTranscript += ` ↳ [${typeTag}: ${att.url}] (${att.name || 'dosya'})\n`;
                });
            }
        }
        const attachmentText = new AttachmentBuilder(Buffer.from(textTranscript, 'utf-8'), { name: `ticket-#${ticketNum}-${interaction.channel.name}.txt` });
        
        try {
            conn = await pool.getConnection();
            await conn.query(
                "UPDATE tickets SET status='closed', closed_by=?, transcript_html=NULL, transcript_text=?, closed_at=NOW() WHERE channel_id=?",
                [interaction.user.id, textTranscript, interaction.channel.id]
            ).catch(e => console.error("DB bilet guncelleme hatası", e));
            
            const rows = await conn.query('SELECT log_ticket_channel_id, log_channel_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
            if (rows.length > 0) {
                const isTicketLogSet = !!rows[0].log_ticket_channel_id;
                const targetChannelId = rows[0].log_ticket_channel_id || rows[0].log_channel_id;
                
                if (targetChannelId) {
                    const logChannel = interaction.guild.channels.cache.get(targetChannelId);
                    if (logChannel) {
                        let payload;
                        if (isTicketLogSet) {
                            payload = createContainerMessage(
                                'Bilet Kapatıldı',
                                `**Kanal:** ${interaction.channel.name}\n**Kapatan Yetkili:** <@${interaction.user.id}>`,
                                COLORS.ERROR, [], [], false, false,
                                [attachmentHtml.name, attachmentText.name]
                            );
                            payload.files = [attachmentHtml, attachmentText];
                        } else {
                            payload = createContainerMessage(
                                'Bilet Kapatıldı',
                                `**Kanal:** ${interaction.channel.name}\n**Kapatan Yetkili:** <@${interaction.user.id}>`,
                                COLORS.ERROR
                            );
                        }
                        await logChannel.send(payload).catch(e => console.error("Log gönderme hatası", e));
                    }
                }
            }
        } finally {
            if (conn) conn.release();
        }
    } catch (e) {
        console.error("Transcript hatası", e);
    }

    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

module.exports = { createTicket, checkTicketLimits, closeTicketChannel };
