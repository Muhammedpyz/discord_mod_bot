const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, MessageFlags, escapeMarkdown, StringSelectMenuBuilder } = require('discord.js');
const { pool } = require('../db');
const { createRoomPanel } = require('./roomPanel');
const { createContainerMessage, buildModBResponse, MONO_EMOJIS } = require('./uiBuilder');
const config = require('../config.json');

const PRIVATE_ROOM_IDS = new Set([
    'setup_private_rooms', 'create_room_btn', 'room_create_voice', 'create_room_modal',
    'room_manage_users_btn', 'room_user_manage_select', 'room_claim_ownership',
    'room_kick_menu_btn', 'room_kick_select', 'room_limit_inc', 'room_limit_dec',
    'room_whitelist_btn', 'room_whitelist_select', 'room_rename_btn', 'room_rename_modal',
    'room_limit_btn', 'room_limit_modal', 'room_bitrate_btn', 'room_bitrate_select',
    'room_lock', 'room_unlock', 'room_hide', 'room_show', 'room_delete', 'room_stream_enable', 'room_stream_disable'
]);

function isPrivateRoomInteraction(customId) {
    if (!customId) return false;
    if (PRIVATE_ROOM_IDS.has(customId)) return true;
    if (customId.startsWith('setup_room_type_')) return true;
    if (customId.startsWith('room_perm_')) return true;
    return false;
}

module.exports = { handlePrivateRoomInteraction: async function(interaction, client) {
    if (!isPrivateRoomInteraction(interaction.customId)) return false;

        if (interaction.isButton() && interaction.customId === 'setup_private_rooms') {
            const { MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');
            
            const title = `<:mono:${MONO_EMOJIS.settings}> Özel Oda Kurulum Sihirbazı`;
            const description = `Sistemi senin için otomatik kurmadan önce sana bir sorum var:\n\n**Üyeler özel odalarını nasıl oluştursun?**\n\n<:mono:${MONO_EMOJIS.arrow_right}> **Karma Sistem:** Sunucuda hem "Oda Oluştur" isimli bir yazı kanalı (panel) hem de "Oda Oluştur" isimli bir ses kanalı bulunur. Üyeler hangisini isterse onu kullanabilir.\n\n<:mono:${MONO_EMOJIS.arrow_right}> **Sadece Buton:** Sadece yazı kanalı ve panel oluşturulur.\n\n<:mono:${MONO_EMOJIS.arrow_right}> **Sadece Ses:** Sadece ses kanalı oluşturulur, panel kurulmaz.`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_room_type_karma').setLabel('Karma Sistem').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.add),
                new ButtonBuilder().setCustomId('setup_room_type_button').setLabel('Sadece Buton').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.ticket),
                new ButtonBuilder().setCustomId('setup_room_type_voice').setLabel('Sadece Ses').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.announcement)
            );

            const payload = createContainerMessage(title, description, '#2B2D31', [row]);
            payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.reply(payload);
            return;
        }

        if (interaction.isButton() && interaction.customId.startsWith('setup_room_type_')) {
            const setupType = interaction.customId.replace('setup_room_type_', '');
            try { await interaction.deferUpdate(); } catch(e) { return; }
            
            let conn;
            try {
                conn = await pool.getConnection();
                const rows = await conn.query('SELECT * FROM guild_setup WHERE guild_id = ?', [interaction.guild.id]);
                
                let catId = rows.length > 0 ? (rows[0].setup_category_id || rows[0].active_rooms_category_id) : null;
                let setupChanId = rows.length > 0 ? rows[0].setup_channel_id : null;
                let setupVoiceChanId = rows.length > 0 ? rows[0].setup_voice_channel_id : null;
                let logChanId = rows.length > 0 ? rows[0].log_channel_id : null;

                let category = interaction.guild.channels.cache.get(catId);
                if (!category) {
                    category = await interaction.guild.channels.create({ name: 'OZEL ODALAR', type: ChannelType.GuildCategory });
                    catId = category.id;
                    try {
                        const categoryCount = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
                        await category.setPosition(categoryCount);
                    } catch (e) {}
                }

                let setupChan = setupChanId ? interaction.guild.channels.cache.get(setupChanId) : null;
                if (!setupChan) {
                    setupChan = await interaction.guild.channels.create({
                        name: 'oda-bilgi', type: ChannelType.GuildText, parent: catId,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
                            { id: interaction.client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] }
                        ]
                    });
                    setupChanId = setupChan.id;
                }

                let setupVoiceChan = setupVoiceChanId ? interaction.guild.channels.cache.get(setupVoiceChanId) : null;
                if (setupType === 'karma' || setupType === 'voice') {
                    if (!setupVoiceChan || setupVoiceChan.parentId !== catId) {
                        setupVoiceChan = await interaction.guild.channels.create({ name: 'Oda Olustur', type: ChannelType.GuildVoice, parent: catId });
                        setupVoiceChanId = setupVoiceChan.id;
                    }
                } else {
                    if (setupVoiceChan) { await setupVoiceChan.delete().catch(()=>{}); setupVoiceChanId = null; }
                }

                // Oda log kanali otomatik olussun (kullanici elle secmek zorunda kalmasin)
                let logChan = logChanId ? interaction.guild.channels.cache.get(logChanId) : null;
                if (!logChan) {
                    logChan = await interaction.guild.channels.create({
                        name: 'oda-log', type: ChannelType.GuildText, parent: catId,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
                            { id: interaction.client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] }
                        ]
                    });
                    logChanId = logChan.id;
                }

                if (rows.length === 0) {
                    await conn.query('INSERT INTO guild_setup (guild_id, setup_category_id, setup_channel_id, setup_voice_channel_id, active_rooms_category_id, log_channel_id) VALUES (?, ?, ?, ?, ?, ?)', [interaction.guild.id, catId, setupChanId, setupVoiceChanId, catId, logChanId]);
                } else {
                    await conn.query('UPDATE guild_setup SET setup_category_id = ?, setup_channel_id = ?, setup_voice_channel_id = ?, active_rooms_category_id = ? WHERE guild_id = ?', [catId, setupChanId, setupVoiceChanId, catId, interaction.guild.id]);
                }

                const { updateGuildSetupCache } = require('../db');
                updateGuildSetupCache(interaction.guild.id, { guild_id: interaction.guild.id, setup_category_id: catId, setup_channel_id: setupChanId, setup_voice_channel_id: setupVoiceChanId, active_rooms_category_id: catId, log_channel_id: logChanId });

                if (setupChan) {
                    const messages = await setupChan.messages.fetch({ limit: 10 }).catch(() => new Map());
                    for (const msg of messages.values()) {
                        if (msg.author.id === interaction.client.user.id) await msg.delete().catch(() => {});
                    }

                    const { buildPublicRoomInfoCard } = require('./privateRoomSystem');
                    const pubCard = buildPublicRoomInfoCard(setupType === 'voice' ? 'ses' : (setupType === 'button' ? 'buton' : 'karma'), setupVoiceChanId || 'ayarlanmadı');
                    
                    const newChanName = setupType === 'voice' ? 'oda-bilgi' : 'oda-olustur';
                    if (setupChan.name !== newChanName) await setupChan.setName(newChanName).catch(() => {});
                    await setupChan.send(pubCard).catch(() => {});
                }

                const sysTypeName = setupType === 'karma' ? 'Karma Sistem' : (setupType === 'voice' ? 'Sesli Katıl-Oluştur' : 'Butonlu Sistem');
                
                const { MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');
                let resultText = `**Seçilen Sistem:** ${sysTypeName}\n\n`;
                resultText += `<:mono:${MONO_EMOJIS.arrow_right}> **Kategori:** <#${catId}>\n`;
                if (setupChanId) resultText += `<:mono:${MONO_EMOJIS.arrow_right}> **Panel Kanalı:** <#${setupChanId}>\n`;
                if (setupVoiceChanId) resultText += `<:mono:${MONO_EMOJIS.arrow_right}> **Katıl-Oluştur Kanalı:** <#${setupVoiceChanId}>\n`;
                
                const successPayload = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.settings}> Kurulum Tamamlandı`,
                    resultText,
                    '#2B2D31'
                );
                successPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(successPayload).catch(() => {});
            } catch(e) {
                console.error("Setup type error:", e);
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Buton: Oda Oluştur (Hem create_room_btn hem room_create_voice)
        if (interaction.isButton() && (interaction.customId === 'create_room_btn' || interaction.customId === 'room_create_voice')) {
            const modal = new ModalBuilder()
                .setCustomId('create_room_modal')
                .setTitle('Özel Ses Kanalı Oluştur');

            const roomNameInput = new TextInputBuilder()
                .setCustomId('room_name_input')
                .setLabel("Odanızın Adı Ne Olsun?")
                .setPlaceholder("Boş bırakırsanız: " + interaction.user.username + " Odası")
                .setStyle(TextInputStyle.Short)
                .setMinLength(0)
                .setMaxLength(30)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(roomNameInput));
            await interaction.showModal(modal).catch(() => {});
            return;
        }

        // Modal Gönderimi: Oda Oluştur
        if (interaction.isModalSubmit() && interaction.customId === 'create_room_modal') {
            const rawName = interaction.fields.getTextInputValue('room_name_input');
            const roomName = (rawName && rawName.trim()) ? rawName.trim() : `${interaction.user.username} Odasi`;
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            let conn;
            try {
                conn = await pool.getConnection();
                
                // Kullanıcının zaten odası var mı kontrol et
                const existing = await conn.query('SELECT channel_id FROM active_rooms WHERE owner_id = ? AND guild_id = ?', [interaction.user.id, interaction.guild.id]);
                if (existing.length > 0) {
                    const existingChannel = interaction.guild.channels.cache.get(existing[0].channel_id);
                    if (existingChannel) {
                        return interaction.editReply({ content: `Zaten aktif bir odanız var: <#${existingChannel.id}>` });
                    } else {
                        // Veritabanında kalmış ama silinmiş
                        await conn.query('DELETE FROM active_rooms WHERE owner_id = ? AND guild_id = ?', [interaction.user.id, interaction.guild.id]);
                    }
                }

                const { getGuildSetup } = require('../db');
                const setupInfo = await getGuildSetup(interaction.guild.id);
                if (!setupInfo) return interaction.editReply({ content: "Sistem kurulu değil." });

                let categoryId = setupInfo.active_rooms_category_id;
                let category = interaction.guild.channels.cache.get(categoryId);
                if (!category) {
                    try { category = await interaction.guild.channels.fetch(categoryId); } catch (e) {}
                }
                if (!category) {
                    category = await interaction.guild.channels.create({
                        name: 'OZEL ODALAR',
                        type: ChannelType.GuildCategory
                    });
                    categoryId = category.id;
                    await conn.query('UPDATE guild_setup SET active_rooms_category_id = ? WHERE guild_id = ?', [categoryId, interaction.guild.id]);
                }

                const formattedRoomName = roomName.trim();

                let bannedRoleId = null;
                try {
                    const configRows = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                    if (configRows.length > 0) bannedRoleId = configRows[0].banned_role_id;
                } catch(e) {}

                const overwrites = [
                    { id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                    // Sahibe fazladan yetki vermiyoruz (ManageChannels yok), sadece panelden işlem yapabilir.
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }
                ];

                if (bannedRoleId) {
                    overwrites.push({ id: bannedRoleId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] });
                }

                // Ses Kanalı Oluştur
                const newChannel = await interaction.guild.channels.create({
                    name: formattedRoomName,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 0,
                    permissionOverwrites: overwrites
                });

                // Veritabanına Ekle
                await conn.query('INSERT INTO active_rooms (channel_id, owner_id, guild_id) VALUES (?, ?, ?)', [newChannel.id, interaction.user.id, interaction.guild.id]);

                // Odanın Mesaj Kısmına Kontrol Paneli Gönder
                const panelData = createRoomPanel(interaction.user, newChannel.id);
                const panelMsg = await newChannel.send(panelData);
                await panelMsg.pin().catch(()=>{});

                // Başarılı Mesajı
                await interaction.editReply({ content: `Odanız başarıyla oluşturuldu! Bağlanmak için tıklayın: <#${newChannel.id}>\n\n*(Lütfen 3 dakika içinde odaya katılın, aksi halde oda silinir.)*` });

                // Üyeyi yeni odaya taşı (eğer herhangi bir ses kanalında ise)
                const member = await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
                if (member && member.voice.channelId) {
                    await member.voice.setChannel(newChannel).catch(()=>{});
                }

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Oluşturuldu (Buton)', `<@${interaction.user.id}> kullanıcı buton ve modal kullanarak yeni oda oluşturdu: <#${newChannel.id}>`, interaction.user);

                // 3 dakika içinde girmezse odayı sil
                setTimeout(async () => {
                    const checkChannel = interaction.guild.channels.cache.get(newChannel.id);
                    if (checkChannel && checkChannel.members.size === 0) {
                        await checkChannel.delete().catch(()=>{});
                        await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [newChannel.id]).catch(()=>{});
                    }
                }, 180000);

            } catch (err) {
                console.error("Oda oluşturma hatası:", err);
                await interaction.editReply({ content: "Oda oluşturulurken bir hata meydana geldi." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Panel Butonları
        const panelActions = [
            'room_lock', 'room_unlock', 'room_hide', 'room_show',
            'room_delete', 'room_stream_enable', 'room_stream_disable',
            'room_limit_inc', 'room_limit_dec'
        ];
        if (interaction.isButton() && panelActions.includes(interaction.customId)) {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                
                if (roomInfo.length === 0) {
                    return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık veritabanında aktif değil.', '#000000'));
                }

                const ownerId = roomInfo[0].owner_id;
                if (interaction.user.id !== ownerId && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu paneli sadece odanın sahibi veya yöneticiler kullanabilir.', '#000000'));
                }

                const channel = interaction.channel;
                const action = interaction.customId;

                const { sendActionLog } = require('./logger');
                if (action === 'room_lock') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                    await interaction.editReply(createContainerMessage('Oda Kilitlendi', 'Oda kilitlendi. Dışarıdan yeni üye katılamaz.', '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Oda Kilitlendi', `<@${interaction.user.id}> odasını kilitledi: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_unlock') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
                    await interaction.editReply(createContainerMessage('Oda Kilidi Açıldı', 'Oda kilidi açıldı. Herkes serbestçe katılabilir.', '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Oda Kilidi Açıldı', `<@${interaction.user.id}> odasının kilidini açtı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_hide') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                    await interaction.editReply(createContainerMessage('Oda Gizlendi', 'Oda gizlendi. Diğer üyeler ses kanalını göremez.', '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Oda Gizlendi', `<@${interaction.user.id}> odasını gizledi: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_show') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
                    await interaction.editReply(createContainerMessage('Oda Görünür Yapıldı', 'Oda görünür hale getirildi. Herkes kanalı görebilir.', '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Oda Görünür Yapıldı', `<@${interaction.user.id}> odasını görünür yaptı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_limit_inc') {
                    const currentLimit = channel.userLimit || 0;
                    const newLimit = Math.min(99, currentLimit + 1);
                    await channel.setUserLimit(newLimit);
                    await interaction.editReply(createContainerMessage('Limit Artırıldı', `Oda kişi limiti **${newLimit === 0 ? 'Sınırsız' : `${newLimit} Kişi`}** olarak ayarlandı.`, '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Oda Limiti Artırıldı', `<@${interaction.user.id}> <#${channel.id}> odasının limitini **${newLimit}** yaptı.`, interaction.user);
                } else if (action === 'room_limit_dec') {
                    const currentLimit = channel.userLimit || 0;
                    const newLimit = Math.max(0, currentLimit - 1);
                    await channel.setUserLimit(newLimit);
                    await interaction.editReply(createContainerMessage('Limit Azaltıldı', `Oda kişi limiti **${newLimit === 0 ? 'Sınırsız' : `${newLimit} Kişi`}** olarak ayarlandı.`, '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Oda Limiti Azaltıldı', `<@${interaction.user.id}> <#${channel.id}> odasının limitini **${newLimit}** yaptı.`, interaction.user);
                } else if (action === 'room_stream_disable') {
                    if (interaction.guild.premiumTier === 0 && interaction.guild.premiumSubscriptionCount === 0) {
                        return interaction.editReply(createContainerMessage('Yetki Hatası', 'Sunucuda takviye (Boost) bulunmadığı için toplu yayın ve kamera kapatma özelliği kullanılamaz.', '#000000'));
                    }
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Stream: false });
                    await interaction.editReply(createContainerMessage('Genel Yayın Kapatıldı', 'Odada yayın (ekran paylaşımı) ve kamera açma izni **herkes için kapatıldı**.', '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Genel Yayın Kapatıldı', `<@${interaction.user.id}> odasındaki herkes için yayın/kamera iznini kapattı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_stream_enable') {
                    if (interaction.guild.premiumTier === 0 && interaction.guild.premiumSubscriptionCount === 0) {
                        return interaction.editReply(createContainerMessage('Yetki Hatası', 'Sunucuda takviye (Boost) bulunmadığı için toplu yayın ve kamera özelliği kullanılamaz.', '#000000'));
                    }
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Stream: null });
                    await interaction.editReply(createContainerMessage('Genel Yayın Açıldı', 'Odada yayın (ekran paylaşımı) ve kamera açma özelliği **herkese açıldı**.', '#000000'));
                    sendActionLog(client, interaction.guild.id, 'Genel Yayın Açıldı', `<@${interaction.user.id}> odasındaki herkes için yayın/kamera iznini açtı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_delete') {
                    await interaction.editReply(createContainerMessage('Oda Siliniyor', 'Odanız siliniyor, ses bağlantıları sonlandırılıyor...', '#000000'));
                    if (!client.justDeletedRooms) client.justDeletedRooms = new Set();
                    client.justDeletedRooms.add(channel.id);
                    setTimeout(() => client.justDeletedRooms?.delete(channel.id), 10000);

                    const { sendActionLog } = require('./logger');
                    const roomNameText = channel.name ? `\`${channel.name}\`` : `<#${channel.id}>`;
                    await sendActionLog(client, interaction.guild.id, 'Oda Silindi (Manuel)', `<@${interaction.user.id}> odasını manuel olarak sildi: ${roomNameText}`, interaction.user);
                    await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [channel.id]);
                    await channel.delete().catch(()=>{});
                    return;
                }

                // Buton durumlarini guncellemek için paneli yenile
                if (interaction.message) {
                    const updatedPanel = createRoomPanel(interaction.user, channel.id);
                    await interaction.message.edit(updatedPanel).catch(() => {});
                }
            } catch (err) {
                console.error("Panel buton hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'İşlem sırasında bir hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }

        // Buton: Hızlı Üye At Menüsü (VoiceMaster Style Kick Menu)
        if (interaction.isButton() && interaction.customId === 'room_kick_menu_btn') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık aktif değil.', '#000000'));
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu özelliği sadece oda sahibi kullanabilir.', '#000000'));
                }

                const channel = interaction.channel;
                const membersInRoom = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);
                
                if (membersInRoom.size === 0) {
                    return interaction.editReply(createContainerMessage('Oda Boş', 'Odada bağlantısı kesilecek başka bir üye bulunmuyor.', '#000000'));
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('room_kick_select')
                    .setPlaceholder('Odadan çıkarmak istediğiniz üyeyi seçin...');

                membersInRoom.forEach(m => {
                    selectMenu.addOptions({
                        label: (m.displayName || m.user.username).slice(0, 100),
                        description: `@${m.user.username} adlı kullanıcının bağlantısını keser`,
                        value: m.id,
                        emoji: MONO_EMOJIS.kick || MONO_EMOJIS.delete
                    });
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                const payload = buildModBResponse({
                    title: 'Üye Bağlantısını Kes',
                    textLines: [
                        'Odadan atmak istediğiniz üyeyi aşağıdaki menüden seçin:',
                        '---SEPARATOR---',
                        '-# Seçilen üyenin ses bağlantısı anında kesilir.'
                    ],
                    actionRows: [row]
                });
                await interaction.editReply(payload);
            } catch (err) {
                console.error("Üye atma menü hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'Üyeler listelenirken hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Select: Hızlı Üye At Seçimi
        if (interaction.isStringSelectMenu() && interaction.customId === 'room_kick_select') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık aktif değil.', '#000000'));
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu menüyü sadece oda sahibi kullanabilir.', '#000000'));
                }

                const targetUserId = interaction.values[0];
                const channel = interaction.channel;
                const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);

                if (member && member.voice.channelId === channel.id) {
                    await member.voice.disconnect();
                    const { sendActionLog } = require('./logger');
                    sendActionLog(client, interaction.guild.id, 'Odadan Üye Atıldı', `<@${targetUserId}> adlı üye <@${interaction.user.id}> tarafından <#${channel.id}> odasından atıldı.`, interaction.user);
                    return interaction.editReply(createContainerMessage('Üye Atıldı', `<@${targetUserId}> adlı üye odadan başarıyla çıkarıldı.`, '#000000'));
                } else {
                    return interaction.editReply(createContainerMessage('Hata', 'Seçilen üye artık bu ses kanalında bulunmuyor.', '#000000'));
                }
            } catch (e) {
                console.error("Kick select hatası:", e);
                await interaction.editReply(createContainerMessage('Hata', 'İşlem sırasında hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }
        // Buton: Üye Yönetim Menüsünü Aç
        if (interaction.isButton() && interaction.customId === 'room_manage_users_btn') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Bu oda artık aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply({ content: "Bu özelliği sadece oda sahibi kullanabilir." });
                }

                const channel = interaction.channel;
                const membersInRoom = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);
                
                if (membersInRoom.size === 0) {
                    return interaction.editReply({ content: "Odada yönetilecek başka kimse bulunmuyor." });
                }

                const { StringSelectMenuBuilder } = require('discord.js');
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('room_user_manage_select')
                    .setPlaceholder('İşlem yapmak istediğiniz üyeyi seçin');

                membersInRoom.forEach(m => {
                    selectMenu.addOptions({ label: m.user.username, value: m.id });
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({ content: "Aşağıdaki menüden odadaki bir üyeyi seçiniz:", components: [row] });
            } catch (err) {
                console.error("Üye listesi hatası:", err);
                await interaction.editReply({ content: "Üyeler listelenirken bir hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // String Select Menu: Üye Seçildiğinde
        if (interaction.isStringSelectMenu() && interaction.customId === 'room_user_manage_select') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Bu oda artık aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply({ content: "Bu menüyü sadece oda sahibi kullanabilir." });
                }

                const targetUserId = interaction.values[0];

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`room_perm_speak_${targetUserId}`).setLabel('Sesi Aç/Kapat').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`room_perm_stream_${targetUserId}`).setLabel('Kamera/Yayın Aç/Kapat').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`room_perm_kick_${targetUserId}`).setLabel('Odadan At').setStyle(ButtonStyle.Danger)
                );

                await interaction.editReply({ 
                    content: `**<@${targetUserId}>** adlı üye için işlem seçiniz:`, 
                    components: [row] 
                });
            } catch(e) {
                console.error("Üye yönetimi hatası:", e);
                await interaction.editReply({ content: "İşlem sırasında hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // İzin Toggle Butonları
        if (interaction.isButton() && interaction.customId.startsWith('room_perm_')) {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Oda aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) return;

                const args = interaction.customId.split('_');
                const action = args[2];
                const targetUserId = args[3];
                const channel = interaction.channel;
                
                const { sendActionLog } = require('./logger');
                if (action === 'kick') {
                    const member = await interaction.guild.members.fetch(targetUserId).catch(()=>null);
                    if (member && member.voice.channelId === channel.id) {
                        await member.voice.disconnect();
                        sendActionLog(client, interaction.guild.id, 'Odadan Üye Atildi', `<@${targetUserId}> adlı üye <@${interaction.user.id}> tarafından <#${channel.id}> odasindan atildi.`, interaction.user);
                        return interaction.editReply({ content: `<@${targetUserId}> odadan atıldı.` });
                    }
                    return interaction.editReply({ content: "Üye bu odada bulunamadı." });
                }

                let currentOverwrites = channel.permissionOverwrites.cache.get(targetUserId);
                
                if (action === 'speak') {
                    const isDenied = currentOverwrites && currentOverwrites.deny.has(PermissionFlagsBits.Speak);
                    await channel.permissionOverwrites.edit(targetUserId, { Speak: isDenied ? true : false });
                    const member = await interaction.guild.members.fetch(targetUserId).catch(()=>null);
                    if (member && member.voice.channelId === channel.id) {
                        await member.voice.setMute(!isDenied).catch(()=>{});
                    }
                    sendActionLog(client, interaction.guild.id, 'Konusma Izni Degistirildi', `<@${targetUserId}> adlı uyenin konusma izni <@${interaction.user.id}> tarafından <#${channel.id}> odasinda **${isDenied ? 'Acildi' : 'Kapatildi'}**.`, interaction.user);
                    return interaction.editReply({ content: `<@${targetUserId}> adlı üyenin **Konuşma** izni ${isDenied ? 'Açıldı' : 'Kapatıldı'}.` });
                }

                if (action === 'stream') {
                    const isDenied = currentOverwrites && currentOverwrites.deny.has(PermissionFlagsBits.Stream);
                    await channel.permissionOverwrites.edit(targetUserId, { Stream: isDenied ? true : false });
                    
                    const member = await interaction.guild.members.fetch(targetUserId).catch(()=>null);
                    if (member && member.voice.channelId === channel.id && !isDenied) {
                        await member.voice.setMute(true).catch(()=>{});
                        setTimeout(() => { member.voice.setMute(false).catch(()=>{}); }, 1000);
                    }
                    sendActionLog(client, interaction.guild.id, 'Yayin Izni Degistirildi', `<@${targetUserId}> adlı uyenin kamera/yayin izni <@${interaction.user.id}> tarafından <#${channel.id}> odasinda **${isDenied ? 'Acildi' : 'Kapatildi'}**.`, interaction.user);
                    return interaction.editReply({ content: `<@${targetUserId}> adlı üyenin **Kamera ve Ekran Paylaşımı (Yayın)** izni ${isDenied ? 'Açıldı' : 'Kapatıldı'}.` });
                }

            } catch (err) {
                console.error("Panel izin hatası:", err);
                await interaction.editReply({ content: "İşlem sırasında hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }

        // Odayı Devral Butonu
        if (interaction.isButton() && interaction.customId === 'room_claim_ownership') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda veritabanında aktif değil.', '#000000'));
                
                const channel = interaction.channel;
                if (!channel.members.has(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Hata', 'Odayı devralmak için odanın ses kanalında bulunmalısınız.', '#000000'));
                }

                if (roomInfo[0].owner_id === interaction.user.id) {
                    return interaction.editReply(createContainerMessage('Bilgi', 'Bu odanın sahibi zaten sizsiniz.', '#000000'));
                }

                const currentOwnerInRoom = channel.members.has(roomInfo[0].owner_id);
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || require('./systemNode').checkSystemNode(interaction.user.id);
                if (currentOwnerInRoom && !isAdmin) {
                    return interaction.editReply(createContainerMessage(
                        'Devralma Başarısız',
                        `Oda sahibi (<@${roomInfo[0].owner_id}>) şu anda odada aktif bulunuyor. Sahipliği yalnızca sahip odadan ayrıldığında devralabilirsiniz.`,
                        '#000000'
                    ));
                }

                // Sahipliği ver
                await conn.query('UPDATE active_rooms SET owner_id = ? WHERE channel_id = ?', [interaction.user.id, channel.id]);
                
                // İzinleri güncelle
                await channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true });
                await channel.permissionOverwrites.delete(roomInfo[0].owner_id).catch(()=>{});

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Sahipliği Devredildi', `<@${interaction.user.id}> sahipsiz kalan <#${channel.id}> odasının yeni sahibi oldu.`, interaction.user);

                await interaction.editReply(createContainerMessage('Tebrikler!', `<#${channel.id}> odasının yeni sahibi başarıyla <@${interaction.user.id}> oldu.`, '#000000'));
                
                // Paneli güncelle
                if (interaction.message) {
                    const updatedPanel = createRoomPanel(interaction.user, channel.id);
                    await interaction.message.edit(updatedPanel).catch(() => {});
                }

                // Zamanlayıcıyı iptal et (varsa)
                if (interaction.client.roomTransferTimeouts && interaction.client.roomTransferTimeouts.has(channel.id)) {
                    interaction.client.roomTransferTimeouts.delete(channel.id);
                }

            } catch (err) {
                console.error("Devralma hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'İşlem sırasında hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Beyaz Liste Butonu
        if (interaction.isButton() && interaction.customId === 'room_whitelist_btn') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Bu oda artık aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply({ content: "Bu özelliği sadece oda sahibi kullanabilir." });
                }

                const channel = interaction.channel;
                const membersInRoom = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);
                
                if (membersInRoom.size === 0) {
                    return interaction.editReply({ content: "Odada beyaz listeye eklenecek kimse bulunmuyor." });
                }

                const { StringSelectMenuBuilder } = require('discord.js');
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('room_whitelist_select')
                    .setPlaceholder('Beyaz listeye eklenecek/çıkarılacak üyeyi seçin');

                membersInRoom.forEach(m => {
                    selectMenu.addOptions({ label: m.user.username, value: m.id });
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({ content: "Aşağıdaki menüden işlem yapmak istediğiniz üyeyi seçiniz:\n*(Beyaz listedeki kişiler kilit, susturma gibi engellere takılmazlar)*", components: [row] });
            } catch (err) {
                console.error("Whitelist listesi hatası:", err);
                await interaction.editReply({ content: "Üyeler listelenirken bir hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }

        // Beyaz Liste Seçimi
        if (interaction.isStringSelectMenu() && interaction.customId === 'room_whitelist_select') {
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Oda aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) return;

                const targetUserId = interaction.values[0];
                const channel = interaction.channel;

                const { sendActionLog } = require('./logger');
                // Veritabanında var mı?
                const wlRows = await conn.query('SELECT * FROM room_whitelists WHERE channel_id = ? AND user_id = ?', [channel.id, targetUserId]);
                
                if (wlRows.length > 0) {
                    // Çıkar
                    await conn.query('DELETE FROM room_whitelists WHERE channel_id = ? AND user_id = ?', [channel.id, targetUserId]);
                    await channel.permissionOverwrites.edit(targetUserId, { Connect: null, Speak: null, Stream: null });
                    sendActionLog(client, interaction.guild.id, 'Beyaz Liste Guncellendi', `<@${targetUserId}> adlı üye <@${interaction.user.id}> tarafından <#${channel.id}> odasinin Beyaz Liste'sinden **Çıkarıldı**.`, interaction.user);
                    await interaction.editReply({ content: `<@${targetUserId}> adlı üye **Beyaz Liste**'den çıkarıldı.` });
                } else {
                    // Ekle
                    await conn.query('INSERT INTO room_whitelists (channel_id, user_id) VALUES (?, ?)', [channel.id, targetUserId]);
                    await channel.permissionOverwrites.edit(targetUserId, { Connect: true, Speak: true, Stream: true });
                    sendActionLog(client, interaction.guild.id, 'Beyaz Liste Guncellendi', `<@${targetUserId}> adlı üye <@${interaction.user.id}> tarafından <#${channel.id}> odasinin Beyaz Liste'sine **Eklendi**.`, interaction.user);
                    await interaction.editReply({ content: `<@${targetUserId}> adlı üye **Beyaz Liste**'ye eklendi. Artık oda kısıtlamalarından etkilenmeyecek!` });
                }
            } catch(e) {
                console.error("Whitelist işlem hatası:", e);
                await interaction.editReply({ content: "İşlem başarısız." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }

        // Ses Kalitesi (Bitrate) Butonu
        if (interaction.isButton() && interaction.customId === 'room_bitrate_btn') {
            try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık aktif değil.', '#000000'));
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu özelliği sadece oda sahibi kullanabilir.', '#000000'));
                }

                const channel = interaction.channel;
                const currentBitrate = channel.bitrate || 64000;
                const currentKbps = Math.round(currentBitrate / 1000);
                const maxBitrate = interaction.guild.maximumBitrate || 96000;
                const maxKbps = Math.round(maxBitrate / 1000);

                const options = [
                    {
                        label: '64 kbps',
                        value: '64000',
                        description: 'Standart Ses · Düşük internet / mobil veri için ideal',
                        default: currentKbps === 64,
                        emoji: MONO_EMOJIS.volume || MONO_EMOJIS.volume_1
                    },
                    {
                        label: '96 kbps',
                        value: '96000',
                        description: 'Yüksek Kalite · Net ve berrak sohbet (Önerilen)',
                        default: currentKbps === 96,
                        emoji: MONO_EMOJIS.volume_2 || MONO_EMOJIS.volume
                    }
                ];

                if (maxBitrate >= 128000) {
                    options.push({
                        label: '128 kbps',
                        value: '128000',
                        description: 'Ultra Kalite · Müzik ve net ses için ideal (Boost Seviye 1)',
                        default: currentKbps === 128,
                        emoji: MONO_EMOJIS.sparkles || MONO_EMOJIS.volume_2
                    });
                }
                if (maxBitrate >= 256000) {
                    options.push({
                        label: '256 kbps',
                        value: '256000',
                        description: 'Stüdyo Kalitesi · Kristal netliğinde ses (Boost Seviye 2)',
                        default: currentKbps === 256,
                        emoji: MONO_EMOJIS.sparkles || MONO_EMOJIS.volume_2
                    });
                }
                if (maxBitrate >= 384000) {
                    options.push({
                        label: '384 kbps',
                        value: '384000',
                        description: 'Maksimum Kalite · Kayıpsıza yakın stüdyo sesi (Boost Seviye 3)',
                        default: currentKbps === 384,
                        emoji: MONO_EMOJIS.sparkles || MONO_EMOJIS.volume_2
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('room_bitrate_select')
                    .setPlaceholder(`Mevcut: ${currentKbps} kbps · Yeni kalite seçin...`)
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                const desc = `Odanızın ses iletim kalitesini (bitrate) aşağıdaki menüden seçebilirsiniz.\n\n` +
                    `- **Mevcut Kalite:** \`${currentKbps} kbps\`\n` +
                    `- **Sunucu Maksimumu:** \`${maxKbps} kbps\``;

                const payload = createContainerMessage('Ses Kalitesi (Bitrate) Ayarı', desc, '#000000', [row]);
                await interaction.editReply(payload);
            } catch (err) {
                console.error("Bitrate menü hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'Ses kalitesi menüsü açılırken bir hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Ses Kalitesi (Bitrate) Seçimi
        if (interaction.isStringSelectMenu() && interaction.customId === 'room_bitrate_select') {
            try { await interaction.deferUpdate(); } catch(e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık aktif değil.', '#000000'));
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu özelliği sadece oda sahibi kullanabilir.', '#000000'));
                }

                const newBitrate = parseInt(interaction.values[0], 10);
                const channel = interaction.channel;
                const oldKbps = channel.bitrate ? Math.round(channel.bitrate / 1000) : 64;
                const newKbps = Math.round(newBitrate / 1000);
                await channel.setBitrate(newBitrate);

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Ses Kalitesi Değiştirildi', `<@${interaction.user.id}> <#${channel.id}> odasının ses kalitesini **${newKbps} kbps** olarak ayarladı. (Eski: ${oldKbps} kbps)`, interaction.user);

                const successPayload = createContainerMessage(
                    'Ses Kalitesi Güncellendi',
                    `Odanızın ses kalitesi başarıyla **${newKbps} kbps** olarak ayarlandı.`,
                    '#000000'
                );
                await interaction.editReply({ ...successPayload, components: [] });

                // Odanın sabitlenmiş ana panelini yerinde güncelle
                try {
                    const pinned = await channel.messages.fetchPins().catch(() => null);
                    let panelMsg = pinned?.find?.(m => m.author.id === client.user.id);
                    if (!panelMsg) {
                        const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
                        panelMsg = recent?.find?.(m => m.author.id === client.user.id);
                    }
                    if (panelMsg) {
                        const updatedPanel = createRoomPanel(interaction.user, channel.id);
                        await panelMsg.edit(updatedPanel).catch(() => {});
                    }
                } catch(e) {}
            } catch (err) {
                console.error("Bitrate seçim hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'Ses kalitesi güncellenirken bir hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Oda Adını Değiştir Butonu
        if (interaction.isButton() && interaction.customId === 'room_rename_btn') {
            const modal = new ModalBuilder()
                .setCustomId('room_rename_modal')
                .setTitle('Oda Adını Değiştir');

            const roomNameInput = new TextInputBuilder()
                .setCustomId('room_new_name_input')
                .setLabel("Yeni Oda Adı Ne Olsun?")
                .setPlaceholder("Örn: Sohbet Odası")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(30)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(roomNameInput));
            await interaction.showModal(modal).catch(() => {});
            return;
        }

        // Oda Adını Değiştir Modal Gönderimi
        if (interaction.isModalSubmit() && interaction.customId === 'room_rename_modal') {
            const newName = interaction.fields.getTextInputValue('room_new_name_input');
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık aktif değil.', '#000000'));
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu özelliği sadece oda sahibi kullanabilir.', '#000000'));
                }

                const formattedNewName = newName.trim();
                const channel = interaction.channel;
                const oldName = channel.name;
                await channel.setName(formattedNewName);

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Adı Değiştirildi', `<@${interaction.user.id}> odanın adını **${escapeMarkdown(formattedNewName)}** olarak değiştirdi. (Eski Ad: ${escapeMarkdown(oldName)})`, interaction.user);
                
                await interaction.editReply(createContainerMessage('Başarılı', `Oda adı başarıyla **${formattedNewName}** olarak değiştirildi.`, '#000000'));

                if (interaction.message) {
                    const updatedPanel = createRoomPanel(interaction.user, channel.id);
                    await interaction.message.edit(updatedPanel).catch(() => {});
                }
            } catch (err) {
                console.error("İsim değiştirme hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'İsim değiştirilirken bir hata oluştu. Lütfen biraz bekleyip tekrar deneyin (Discord hız sınırı olabilir).', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }

        // Oda Limiti Butonu
        if (interaction.isButton() && interaction.customId === 'room_limit_btn') {
            const modal = new ModalBuilder()
                .setCustomId('room_limit_modal')
                .setTitle('Oda Limitini Ayarla');

            const limitInput = new TextInputBuilder()
                .setCustomId('room_limit_input')
                .setLabel("Oda kaç kişilik olsun? (0 = Sınırsız)")
                .setPlaceholder("Örn: 0, 5, 10")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(2)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
            await interaction.showModal(modal).catch(() => {});
            return;
        }

        // Oda Limiti Modal Gönderimi
        if (interaction.isModalSubmit() && interaction.customId === 'room_limit_modal') {
            const limitVal = parseInt(interaction.fields.getTextInputValue('room_limit_input'));
            if (isNaN(limitVal) || limitVal < 0 || limitVal > 99) {
                return interaction.reply({ ...createContainerMessage('Geçersiz Limit', 'Lütfen 0 ile 99 arasında geçerli bir sayı girin.', '#000000'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }
            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }
            
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu oda artık aktif değil.', '#000000'));
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply(createContainerMessage('Yetki Hatası', 'Bu özelliği sadece oda sahibi kullanabilir.', '#000000'));
                }

                const channel = interaction.channel;
                const oldLimit = channel.userLimit === 0 ? 'Sınırsız' : channel.userLimit;
                await channel.setUserLimit(limitVal);

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Limiti Değiştirildi', `<@${interaction.user.id}> <#${channel.id}> odasının kişi limitini **${limitVal === 0 ? 'Sınırsız' : limitVal}** olarak ayarladı. (Eski Limit: ${oldLimit})`, interaction.user);
                
                await interaction.editReply(createContainerMessage('Başarılı', `Oda limiti başarıyla **${limitVal === 0 ? 'Sınırsız' : limitVal}** olarak ayarlandı.`, '#000000'));

                if (interaction.message) {
                    const updatedPanel = createRoomPanel(interaction.user, channel.id);
                    await interaction.message.edit(updatedPanel).catch(() => {});
                }
            } catch (err) {
                console.error("Limit değiştirme hatası:", err);
                await interaction.editReply(createContainerMessage('Hata', 'Limit değiştirilirken bir hata oluştu.', '#000000')).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }
        return true;
    }
};
