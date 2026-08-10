const { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool, getGuildSetup } = require('../db');
const { createRoomPanel } = require('../utils/roomPanel');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        let conn;
        try {
            conn = await pool.getConnection();
            const guildId = newState.guild.id || oldState.guild.id;
            const { sendVoiceLog } = require('../utils/logger');

            // 0. AYNI ODA İÇİNDEKİ DEĞİŞİKLİKLER (Yayın, Kamera, Mute, Deafen, Self-Mute, Self-Deafen)
            if (oldState.channelId === newState.channelId && newState.channelId) {
                if (!client.mediaTimers) client.mediaTimers = new Map();

                const scopeKey = `room:${newState.channelId}`;
                const channelMention = `<#${newState.channelId}>`;

                // Ekran Paylaşımı / Yayın
                if (!oldState.streaming && newState.streaming) {
                    client.mediaTimers.set(`stream_${newState.member.id}`, Date.now());
                    sendVoiceLog(client, guildId, 'Yayın Açıldı', `<@${newState.member.id}>, ${channelMention} kanalında ekran paylaşımı başlattı.`, newState.member.user, scopeKey);
                } else if (oldState.streaming && !newState.streaming) {
                    const start = client.mediaTimers.get(`stream_${newState.member.id}`);
                    let sureText = '';
                    if (start) {
                        const diff = Math.floor((Date.now() - start) / 1000);
                        const min = Math.floor(diff / 60);
                        const sec = diff % 60;
                        sureText = ` (Süre: ${min} dk ${sec} sn)`;
                        client.mediaTimers.delete(`stream_${newState.member.id}`);
                    }
                    sendVoiceLog(client, guildId, 'Yayın Kapatıldı', `<@${newState.member.id}>, ${channelMention} kanalında ekran paylaşımını kapattı.${sureText}`, newState.member.user, scopeKey);
                }

                // Kamera
                if (!oldState.selfVideo && newState.selfVideo) {
                    client.mediaTimers.set(`cam_${newState.member.id}`, Date.now());
                    sendVoiceLog(client, guildId, 'Kamera Açıldı', `<@${newState.member.id}>, ${channelMention} kanalında kamerasını açtı.`, newState.member.user, scopeKey);
                } else if (oldState.selfVideo && !newState.selfVideo) {
                    const start = client.mediaTimers.get(`cam_${newState.member.id}`);
                    let sureText = '';
                    if (start) {
                        const diff = Math.floor((Date.now() - start) / 1000);
                        const min = Math.floor(diff / 60);
                        const sec = diff % 60;
                        sureText = ` (Süre: ${min} dk ${sec} sn)`;
                        client.mediaTimers.delete(`cam_${newState.member.id}`);
                    }
                    sendVoiceLog(client, guildId, 'Kamera Kapatıldı', `<@${newState.member.id}>, ${channelMention} kanalında kamerasını kapattı.${sureText}`, newState.member.user, scopeKey);
                }

                // Kullanıcı Kendi Mikrofonunu Kapattı/Açtı
                if (!oldState.selfMute && newState.selfMute) {
                    sendVoiceLog(client, guildId, 'Mikrofon Kapattı', `<@${newState.member.id}> ${channelMention} kanalında mikrofonunu kapattı.`, newState.member.user, scopeKey);
                } else if (oldState.selfMute && !newState.selfMute) {
                    sendVoiceLog(client, guildId, 'Mikrofon Açtı', `<@${newState.member.id}> ${channelMention} kanalında mikrofonunu açtı.`, newState.member.user, scopeKey);
                }

                // Kullanıcı Kendi Kulaklığını Kapattı/Açtı
                if (!oldState.selfDeaf && newState.selfDeaf) {
                    sendVoiceLog(client, guildId, 'Kulaklık Kapattı', `<@${newState.member.id}> ${channelMention} kanalında kulaklığını kapattı (sağırlaştı).`, newState.member.user, scopeKey);
                } else if (oldState.selfDeaf && !newState.selfDeaf) {
                    sendVoiceLog(client, guildId, 'Kulaklık Açtı', `<@${newState.member.id}> ${channelMention} kanalında kulaklığını açtı.`, newState.member.user, scopeKey);
                }

                // Sunucu Mute
                if (!oldState.serverMute && newState.serverMute) {
                    sendVoiceLog(client, guildId, 'Susturuldu (Sunucu)', `<@${newState.member.id}> ${channelMention} kanalında yetkili tarafından susturuldu.`, newState.member.user, scopeKey);
                } else if (oldState.serverMute && !newState.serverMute) {
                    sendVoiceLog(client, guildId, 'Susturması Kaldırıldı', `<@${newState.member.id}> ${channelMention} kanalında susturması kaldırıldı.`, newState.member.user, scopeKey);
                }

                // Sunucu Deafen
                if (!oldState.serverDeaf && newState.serverDeaf) {
                    sendVoiceLog(client, guildId, 'Kulaklığı Kapatıldı', `<@${newState.member.id}> ${channelMention} kanalında yetkili tarafından kulaklığı kapatıldı.`, newState.member.user, scopeKey);
                } else if (oldState.serverDeaf && !newState.serverDeaf) {
                    sendVoiceLog(client, guildId, 'Kulaklığı Açıldı', `<@${newState.member.id}> ${channelMention} kanalında kulaklığı açıldı.`, newState.member.user, scopeKey);
                }
                return;
            }

            const isMove = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

            // 1. KULLANICI BİR ODAYA GİRDİĞİNDE veya TAŞINDIĞINDA
            if (newState.channelId) {
                const setupInfo = await getGuildSetup(guildId);
                const scopeKey = `room:${newState.channelId}`;
                const channelMention = `<#${newState.channelId}>`;

                // Join-to-Create (Özel Oda Sistemi) kontrolü
                if (setupInfo && setupInfo.setup_voice_channel_id === newState.channelId) {
                    const member = newState.member;
                    
                    const existing = await conn.query('SELECT channel_id FROM active_rooms WHERE owner_id = ? AND guild_id = ?', [member.id, guildId]);
                    if (existing.length > 0) {
                        const existingChannel = newState.guild.channels.cache.get(existing[0].channel_id);
                        if (existingChannel) {
                            await member.voice.setChannel(existingChannel).catch(()=>{});
                            if (conn) conn.release();
                            return;
                        } else {
                            await conn.query('DELETE FROM active_rooms WHERE owner_id = ? AND guild_id = ?', [member.id, guildId]);
                        }
                    }

                    let categoryId = setupInfo.active_rooms_category_id;
                    let category = newState.guild.channels.cache.get(categoryId);
                    if (!category) {
                        try { category = await newState.guild.channels.fetch(categoryId); } catch (e) {}
                    }
                    if (!category) {
                        category = await newState.guild.channels.create({
                            name: 'OZEL ODALAR',
                            type: ChannelType.GuildCategory
                        });
                        categoryId = category.id;
                        await conn.query('UPDATE guild_setup SET active_rooms_category_id = ? WHERE guild_id = ?', [categoryId, guildId]);
                    }

                    let bannedRoleId = null;
                    try {
                        const configRows = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [guildId]);
                        if (configRows.length > 0) bannedRoleId = configRows[0].banned_role_id;
                    } catch(e) {}

                    const overwrites = [
                        { id: guildId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }
                    ];

                    if (bannedRoleId) {
                        overwrites.push({ id: bannedRoleId, deny: [PermissionFlagsBits.ViewChannel] });
                    }

                    const newChannel = await newState.guild.channels.create({
                        name: `${member.user.username} Odasi`,
                        type: ChannelType.GuildVoice,
                        parent: categoryId,
                        userLimit: 0,
                        permissionOverwrites: overwrites
                    });

                    await conn.query('INSERT INTO active_rooms (channel_id, owner_id, guild_id) VALUES (?, ?, ?)', [newChannel.id, member.id, guildId]);
                    await member.voice.setChannel(newChannel).catch(()=>{});

                    const panelData = createRoomPanel(member.user, newChannel.id);
                    const panelMsg = await newChannel.send(panelData);
                    await panelMsg.pin().catch(()=>{});

                    sendVoiceLog(client, guildId, 'Özel Oda Oluşturuldu', `<@${member.id}> ses kanalına girerek yeni özel oda oluşturdu: <#${newChannel.id}>`, member.user, `room:${newChannel.id}`);
                } else if (isMove) {
                    sendVoiceLog(client, guildId, 'Kanal Değiştirdi', `<@${newState.member.id}> ses kanalını değiştirdi: <#${oldState.channelId}> ➔ <#${newState.channelId}>`, newState.member.user, scopeKey);
                } else {
                    sendVoiceLog(client, guildId, 'Kanala Katıldı', `<@${newState.member.id}> ses kanalına katıldı: ${channelMention}`, newState.member.user, scopeKey);
                }

                // Zamanlayıcıları iptal et
                const activeRoomRows = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [newState.channelId]);
                if (activeRoomRows.length > 0) {
                    const ownerId = activeRoomRows[0].owner_id;
                    if (client.roomDeleteTimeouts && client.roomDeleteTimeouts.has(newState.channelId)) {
                        clearTimeout(client.roomDeleteTimeouts.get(newState.channelId));
                        client.roomDeleteTimeouts.delete(newState.channelId);
                    }
                    if (newState.member.id === ownerId && client.roomTransferTimeouts && client.roomTransferTimeouts.has(newState.channelId)) {
                        clearTimeout(client.roomTransferTimeouts.get(newState.channelId));
                        client.roomTransferTimeouts.delete(newState.channelId);
                    }
                }
            }

            // 2. KULLANICI BİR ODADAN ÇIKTIĞINDA
            if (oldState.channelId && !isMove) {
                const scopeKey = `room:${oldState.channelId}`;
                const channelMention = `<#${oldState.channelId}>`;

                const activeRoomRows = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [oldState.channelId]);
                const channel = oldState.guild.channels.cache.get(oldState.channelId);

                if (client.mediaTimers) {
                    let streamStart = client.mediaTimers.get(`stream_${oldState.member.id}`);
                    if (streamStart) {
                        const diff = Math.floor((Date.now() - streamStart) / 1000);
                        const min = Math.floor(diff / 60);
                        const sec = diff % 60;
                        client.mediaTimers.delete(`stream_${oldState.member.id}`);
                        sendVoiceLog(client, oldState.guild.id, 'Yayın Kapatıldı', `<@${oldState.member.id}> kanaldan ayrıldığı için yayını kapandı. (Süre: ${min} dk ${sec} sn) ${channelMention}`, oldState.member.user, scopeKey);
                    }
                    
                    let camStart = client.mediaTimers.get(`cam_${oldState.member.id}`);
                    if (camStart) {
                        const diff = Math.floor((Date.now() - camStart) / 1000);
                        const min = Math.floor(diff / 60);
                        const sec = diff % 60;
                        client.mediaTimers.delete(`cam_${oldState.member.id}`);
                        sendVoiceLog(client, oldState.guild.id, 'Kamera Kapatıldı', `<@${oldState.member.id}> kanaldan ayrıldığı için kamerası kapandı. (Süre: ${min} dk ${sec} sn) ${channelMention}`, oldState.member.user, scopeKey);
                    }
                }

                sendVoiceLog(client, oldState.guild.id, 'Kanaldan Ayrıldı', `<@${oldState.member.id}> ses kanalından ayrıldı: ${channelMention}`, oldState.member.user, scopeKey);

                if (activeRoomRows.length > 0) {
                    const ownerId = activeRoomRows[0].owner_id;
                    if (channel) {
                        const memberCount = channel.members.filter(m => !m.user.bot).size;

                        if (memberCount === 0) {
                            if (client.roomDeleteTimeouts && client.roomDeleteTimeouts.has(oldState.channelId)) {
                                clearTimeout(client.roomDeleteTimeouts.get(oldState.channelId));
                            }
                            const timeoutId = setTimeout(async () => {
                                let c;
                                try {
                                    c = await pool.getConnection();
                                    const ch = oldState.guild.channels.cache.get(oldState.channelId);
                                    if (ch && ch.members.size === 0) {
                                        const { sendVoiceLog } = require('../utils/logger');
                                        await sendVoiceLog(client, oldState.guild.id, 'Özel Oda Silindi (Otomatik)', `Özel oda boş kaldığı için otomatik olarak silindi: ${channelMention}`, null, scopeKey);
                                        await ch.delete().catch(() => {});
                                    }
                                    await c.query('DELETE FROM active_rooms WHERE channel_id = ?', [oldState.channelId]);
                                } catch(e){} finally {
                                    if(c) c.release();
                                    if (client.roomDeleteTimeouts) client.roomDeleteTimeouts.delete(oldState.channelId);
                                }
                            }, 60000);
                            if (!client.roomDeleteTimeouts) client.roomDeleteTimeouts = new Map();
                            client.roomDeleteTimeouts.set(oldState.channelId, timeoutId);
                        } else if (oldState.member.id === ownerId) {
                            if (client.roomTransferTimeouts && client.roomTransferTimeouts.has(oldState.channelId)) {
                                clearTimeout(client.roomTransferTimeouts.get(oldState.channelId));
                            }
                            const timeoutId = setTimeout(async () => {
                                const ch = oldState.guild.channels.cache.get(oldState.channelId);
                                if (ch && !ch.members.has(ownerId) && ch.members.filter(m => !m.user.bot).size > 0) {
                                    const row = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder().setCustomId('room_claim_ownership').setLabel('Odayı Devral').setStyle(ButtonStyle.Success)
                                    );
                                    const transferPayload = createContainerMessage(
                                        'Sahiplik Devri',
                                        'Oda sahibi 5 dakikadan uzun süredir odada değil.\nAşağıdaki butona tıklayan ilk kişi odanın yeni sahibi olur!',
                                        '#313338',
                                        [row]
                                    );
                                    await ch.send(transferPayload).catch(()=>{});
                                }
                                if (client.roomTransferTimeouts) client.roomTransferTimeouts.delete(oldState.channelId);
                            }, 300000);
                            if (!client.roomTransferTimeouts) client.roomTransferTimeouts = new Map();
                            client.roomTransferTimeouts.set(oldState.channelId, timeoutId);
                        }
                    } else {
                        await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [oldState.channelId]);
                    }
                }
            }
        } catch (err) {
            console.error("Ses olay hatası:", err);
        } finally {
            if (conn) conn.release();
        }
    }
};
