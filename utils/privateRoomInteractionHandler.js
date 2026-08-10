const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, escapeMarkdown } = require('discord.js');
const { pool } = require('../db');
const { createRoomPanel } = require('./roomPanel');
const config = require('../config.json');

module.exports = { handlePrivateRoomInteraction: async function(interaction, client) {
    
    
        // Özel Oda Butonları ve Modalları Başlangıcı

        if (interaction.isButton() && interaction.customId === 'setup_private_rooms') {
            const { EMOJIS, MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');
            
            const title = `${EMOJIS.settings} Özel Oda Kurulum Sihirbazı`;
            const description = `Sistemi senin için otomatik kurmadan önce sana bir sorum var:\n\n**Üyeler özel odalarını nasıl oluştursun?**\n\n${EMOJIS.arrow_right} **Karma Sistem:** Sunucuda hem "Oda Oluştur" isimli bir yazı kanalı (panel) hem de "Oda Oluştur" isimli bir ses kanalı bulunur. Üyeler hangisini isterse onu kullanabilir.\n\n${EMOJIS.arrow_right} **Sadece Buton:** Sadece yazı kanalı ve panel oluşturulur.\n\n${EMOJIS.arrow_right} **Sadece Ses:** Sadece ses kanalı oluşturulur, panel kurulmaz.`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_room_type_karma').setLabel('Karma Sistem').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.add),
                new ButtonBuilder().setCustomId('setup_room_type_button').setLabel('Sadece Buton').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.ticket),
                new ButtonBuilder().setCustomId('setup_room_type_voice').setLabel('Sadece Ses').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.announcement)
            );

            const payload = createContainerMessage(title, description, '', [row]);
            payload.ephemeral = true;
            await interaction.reply(payload);
            return;
        }

        if (interaction.isButton() && interaction.customId.startsWith('setup_room_type_')) {
            const setupType = interaction.customId.replace('setup_room_type_', '');
            await interaction.deferUpdate();
            
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
                    const messages = await setupChan.messages.fetch({ limit: 10 });
                    for (const msg of messages.values()) { if (msg.author.id === interaction.client.user.id) await msg.delete().catch(()=>{}); }

                    const { EMOJIS, createContainerMessage } = require('./uiBuilder');
                    if (setupType === 'karma' || setupType === 'button') {
                        let desc = '';
                        if (setupType === 'karma') {
                            desc = `**Özel Odanızı Nasıl Oluşturabilirsiniz?**\n\nBu sunucuda Karma Özel Oda Sistemi aktiftir. İki farklı yöntemle odanızı saniyeler içinde oluşturabilirsiniz:\n\n${EMOJIS.arrow_right} **1. Metin ile (Butonlu):** Aşağıdaki **"Oda Oluştur"** butonuna tıklayıp açılan pencereye odanızın adını yazarak.\n${EMOJIS.arrow_right} **2. Ses ile (Otomatik):** Doğrudan <#${setupVoiceChanId}> kanalına katılarak.\n\nOdanızı oluşturduktan sonra bu sohbete düşecek olan **Kontrol Paneli** üzerinden odanızı kilitleyebilir, gizleyebilir veya yönelebilirsiniz.`;
                        } else {
                            desc = `**Özel Odanızı Nasıl Oluşturabilirsiniz?**\n\nAşağıdaki **"Oda Oluştur"** butonuna tıklayarak saniyeler içinde tamamen size ait bir özel ses kanalı oluşturabilirsiniz.\n\nOdanızı oluşturduktan sonra bu sohbete düşecek olan **Kontrol Paneli** üzerinden odanızı kilitleyebilir, gizleyebilir veya üyeleri yönetebilirsiniz.`;
                        }

                        const btnRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("create_room_btn").setLabel("Oda Oluştur").setStyle(ButtonStyle.Success)
                        );
                        
                        const uiPayload = createContainerMessage(`${EMOJIS.settings} Özel Oda Kurulum Sistemi`, desc, '', [btnRow], [], false);
                        if (setupChan.name !== 'oda-olustur') await setupChan.setName('oda-olustur').catch(()=>{});
                        await setupChan.send(uiPayload);
                    } else if (setupType === 'voice') {
                        const uiPayload = createContainerMessage(`${EMOJIS.settings} Sesli Katıl-Oluştur Sistemi`, `**Özel Odanızı Nasıl Oluşturabilirsiniz?**\n\nKendinize ait özel bir ses kanalı oluşturmak için hiçbir butona basmanıza gerek yok! Sadece **<#${setupVoiceChanId}>** ses kanalına katılmanız yeterli.\n\nKatıldığınız anda sistem sizin için anında yeni bir oda oluşturacak ve sizi o odaya çekecektir.\n\nOdanıza geçtikten sonra, bu sohbet kanalına sizin için özel bir **Kontrol Paneli** gönderilecek. O panelden odanızı yönetebilirsiniz.`, '', [], [], false);
                        if (setupChan.name !== 'oda-bilgi') await setupChan.setName('oda-bilgi').catch(()=>{});
                        await setupChan.send(uiPayload);
                    }
                }

                const { getSettingsPage } = require('../commands/moderation/settings');
                const pageData = await getSettingsPage(interaction.guild.id, 'page_rooms');
                if (pageData) await interaction.message.edit(pageData).catch(()=>{});
                
                const sysTypeName = setupType === 'karma' ? 'Karma Sistem' : (setupType === 'voice' ? 'Sesli Katıl-Oluştur' : 'Butonlu Sistem');
                
                const { EMOJIS, createContainerMessage } = require('./uiBuilder');
                let resultText = `**Seçilen Sistem:** ${sysTypeName}\n\n`;
                resultText += `${EMOJIS.arrow_right} **Kategori:** <#${catId}>\n`;
                if (setupChanId) resultText += `${EMOJIS.arrow_right} **Panel Kanalı:** <#${setupChanId}>\n`;
                if (setupVoiceChanId) resultText += `${EMOJIS.arrow_right} **Katıl-Oluştur Kanalı:** <#${setupVoiceChanId}>\n`;
                
                const resultPayload = createContainerMessage(`${EMOJIS.check} Özel Oda Sistemi Başarıyla Kuruldu!`, resultText);
                
                await interaction.editReply(resultPayload);

            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: 'Kurulum sırasında bir hata oluştu.' }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
            return;
        }

        // Buton: Oda Oluştur
        if (interaction.isButton() && interaction.customId === 'create_room_btn') {
            const modal = new ModalBuilder()
                .setCustomId('create_room_modal')
                .setTitle('Özel Ses Kanalı Oluştur');

            const roomNameInput = new TextInputBuilder()
                .setCustomId('room_name_input')
                .setLabel("Odanizin Adi Ne Olsun?")
                .setPlaceholder("Bos birakirsaniz: " + interaction.user.username + " Odasi")
                .setStyle(TextInputStyle.Short)
                .setMinLength(0)
                .setMaxLength(30)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(roomNameInput));
            await interaction.showModal(modal);
            return;
        }

        // Modal Gönderimi: Oda Oluştur
        if (interaction.isModalSubmit() && interaction.customId === 'create_room_modal') {
            const rawName = interaction.fields.getTextInputValue('room_name_input');
            const roomName = (rawName && rawName.trim()) ? rawName.trim() : `${interaction.user.username} Odasi`;
            await interaction.deferReply({ ephemeral: true });

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
                    overwrites.push({ id: bannedRoleId, deny: [PermissionFlagsBits.ViewChannel] });
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
        const panelActions = ['room_lock', 'room_unlock', 'room_hide', 'room_show', 'room_delete', 'room_stream_enable', 'room_stream_disable'];
        if (interaction.isButton() && panelActions.includes(interaction.customId)) {
            await interaction.deferReply({ ephemeral: true });
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                
                if (roomInfo.length === 0) {
                    return interaction.editReply({ content: "Bu oda artık veritabanında aktif değil." });
                }

                const ownerId = roomInfo[0].owner_id;
                if (interaction.user.id !== ownerId && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply({ content: "Bu paneli sadece odanın sahibi veya yöneticiler kullanabilir." });
                }

                const channel = interaction.channel;
                const action = interaction.customId;

                const { sendActionLog } = require('./logger');
                if (action === 'room_lock') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                    await interaction.editReply({ content: "Oda kilitlendi. Dışarıdan kimse katılamaz." });
                    sendActionLog(client, interaction.guild.id, 'Oda Kilitlendi', `<@${interaction.user.id}> odasını kilitledi: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_unlock') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
                    await interaction.editReply({ content: "Oda kilidi açıldı. Herkes katılabilir." });
                    sendActionLog(client, interaction.guild.id, 'Oda Kilidi Açıldı', `<@${interaction.user.id}> odasının kilidini açtı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_hide') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                    await interaction.editReply({ content: "Oda gizlendi. Diğer üyeler odayı göremez." });
                    sendActionLog(client, interaction.guild.id, 'Oda Gizlendi', `<@${interaction.user.id}> odasını gizledi: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_show') {
                    await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
                    await interaction.editReply({ content: "Oda görünür hale getirildi." });
                    sendActionLog(client, interaction.guild.id, 'Oda Görünür Yapıldı', `<@${interaction.user.id}> odasını görünür yaptı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_stream_disable') {
                    if (interaction.guild.premiumTier === 0 && interaction.guild.premiumSubscriptionCount === 0) {
                        return interaction.editReply({ content: "Sunucuda yeterli Nitro/Takviye (Boost) bulunmadığı için toplu yayın ve kamera kapatma özelliği kullanılamaz." });
                    }
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Stream: false });
                    await interaction.editReply({ content: "Odada yayın (ekran paylaşımı) ve kamera açma özelliği **herkes için kapatıldı**." });
                    sendActionLog(client, interaction.guild.id, 'Genel Yayın Kapatıldı', `<@${interaction.user.id}> odasındaki herkes için yayın/kamera iznini kapattı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_stream_enable') {
                    if (interaction.guild.premiumTier === 0 && interaction.guild.premiumSubscriptionCount === 0) {
                        return interaction.editReply({ content: "Sunucuda yeterli Nitro/Takviye (Boost) bulunmadığı için toplu yayın ve kamera özelliği kullanılamaz." });
                    }
                    await channel.permissionOverwrites.edit(interaction.guild.id, { Stream: null });
                    await interaction.editReply({ content: "Odada yayın (ekran paylaşımı) ve kamera açma özelliği **tekrar açıldı**." });
                    sendActionLog(client, interaction.guild.id, 'Genel Yayın Açıldı', `<@${interaction.user.id}> odasındaki herkes için yayın/kamera iznini açtı: <#${channel.id}>`, interaction.user);
                } else if (action === 'room_delete') {
                    await interaction.editReply({ content: "Oda siliniyor..." });
                    const { sendActionLog } = require('./logger');
                    await sendActionLog(client, interaction.guild.id, 'Oda Silindi (Manuel)', `<@${interaction.user.id}> odasını manuel olarak sildi: <#${channel.id}>`, interaction.user);
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
                await interaction.editReply({ content: "İşlem sırasında hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }
        // Buton: Üye Yönetim Menüsünü Aç
        if (interaction.isButton() && interaction.customId === 'room_manage_users_btn') {
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.deferReply();
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Oda aktif değil." });
                
                const channel = interaction.channel;
                if (!channel.members.has(interaction.user.id)) {
                    return interaction.editReply({ content: "Odayı devralmak için odada bulunmalısınız." });
                }

                // Sahipliği ver
                await conn.query('UPDATE active_rooms SET owner_id = ? WHERE channel_id = ?', [interaction.user.id, channel.id]);
                
                // İzinleri güncelle
                await channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true });
                await channel.permissionOverwrites.delete(roomInfo[0].owner_id).catch(()=>{});

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Sahipligi Devredildi', `<@${interaction.user.id}> sahipsiz kalan <#${channel.id}> odasinin yeni sahibi oldu.`, interaction.user);

                await interaction.editReply({ content: `Tebrikler! <#${channel.id}> odasının yeni sahibi <@${interaction.user.id}> oldu.` });
                
                // Yeni panel gönder
                const panelData = createRoomPanel(interaction.user, channel.id);
                const panelMsg = await channel.send(panelData);
                await panelMsg.pin().catch(()=>{});

                // Zamanlayıcıyı iptal et (varsa)
                if (interaction.client.roomTransferTimeouts && interaction.client.roomTransferTimeouts.has(channel.id)) {
                    interaction.client.roomTransferTimeouts.delete(channel.id);
                }

            } catch (err) {
                console.error("Devralma hatası:", err);
                await interaction.editReply({ content: "Hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }

        // Beyaz Liste Butonu
        if (interaction.isButton() && interaction.customId === 'room_whitelist_btn') {
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.showModal(modal);
            return;
        }

        // Oda Adını Değiştir Modal Gönderimi
        if (interaction.isModalSubmit() && interaction.customId === 'room_rename_modal') {
            const newName = interaction.fields.getTextInputValue('room_new_name_input');
            await interaction.deferReply({ ephemeral: true });
            
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Oda aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply({ content: "Bu özelliği sadece oda sahibi kullanabilir." });
                }

                const formattedNewName = newName.trim();

                const channel = interaction.channel;
                const oldName = channel.name;
                await channel.setName(formattedNewName);

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Ad Degistirildi', `<@${interaction.user.id}> <#${channel.id}> odasinin adini **${escapeMarkdown(formattedNewName)}** olarak degistirdi. (Eski Ad: ${escapeMarkdown(oldName)})`, interaction.user);
                
                await interaction.editReply({ content: `Oda adı başarıyla **${formattedNewName}** olarak değiştirildi.` });
            } catch (err) {
                console.error("İsim değiştirme hatası:", err);
                await interaction.editReply({ content: "İsim değiştirilirken bir hata oluştu. Lütfen biraz bekleyip tekrar deneyin (Discord API sınırı olabilir)." }).catch(()=>{});
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
            await interaction.showModal(modal);
            return;
        }

        // Oda Limiti Modal Gönderimi
        if (interaction.isModalSubmit() && interaction.customId === 'room_limit_modal') {
            const limitVal = parseInt(interaction.fields.getTextInputValue('room_limit_input'));
            if (isNaN(limitVal) || limitVal < 0 || limitVal > 99) {
                return interaction.reply({ content: 'Lütfen 0 ile 99 arasında geçerli bir sayı girin.', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            
            let conn;
            try {
                conn = await pool.getConnection();
                const roomInfo = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [interaction.channelId]);
                if (roomInfo.length === 0) return interaction.editReply({ content: "Oda aktif değil." });
                if (interaction.user.id !== roomInfo[0].owner_id && !interaction.member.permissions.has('Administrator') && !require('./systemNode').checkSystemNode(interaction.user.id)) {
                    return interaction.editReply({ content: "Bu özelliği sadece oda sahibi kullanabilir." });
                }

                const channel = interaction.channel;
                const oldLimit = channel.userLimit === 0 ? 'Sinirsiz' : channel.userLimit;
                await channel.setUserLimit(limitVal);

                const { sendActionLog } = require('./logger');
                sendActionLog(client, interaction.guild.id, 'Oda Limiti Degistirildi', `<@${interaction.user.id}> <#${channel.id}> odasinin kisi limitini **${limitVal === 0 ? 'Sinirsiz' : limitVal}** olarak ayarladi. (Eski Limit: ${oldLimit})`, interaction.user);
                
                await interaction.editReply({ content: `Oda limiti başarıyla **${limitVal === 0 ? 'Sınırsız' : limitVal}** olarak ayarlandı.` });
            } catch (err) {
                console.error("Limit değiştirme hatası:", err);
                await interaction.editReply({ content: "Limit değiştirilirken bir hata oluştu." }).catch(()=>{});
            } finally {
                if (conn) conn.release();
            }
        }
    }
};
