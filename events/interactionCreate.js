const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder, MessageFlags } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { pool, updateConfigCache } = require('../db');
const config = require('../config.json');
const { createContainerMessage, buildModBResponse, buildModAPanel } = require('../utils/uiBuilder');
const systemNode = require('../utils/systemNode');
const { handleSorguSelect, handleExport } = require('../utils/sorguHelpers');
const { generateDiscordTranscriptHtml, generateDiscordTranscriptText } = require('../utils/discordHtmlExporter');
const { helpEmbedHome, createHelpComponents } = require('../commands/moderation/yardim');
const { logCommandExecution } = require('../utils/commandLogger');

async function sendInteractionErrorResponse(interaction, errorMsg, err = null, source = 'COMPONENT') {
    try {
        logCommandExecution({
            interaction,
            commandName: `${source}:${interaction.customId || 'unknown'}`,
            durationMs: 0,
            success: false,
            error: err || new Error(errorMsg)
        });
    } catch (logErr) {
        console.error('[sendInteractionErrorResponse] Log hatası:', logErr.message);
    }

    if (!interaction.isRepliable()) return;

    const payload = buildModBResponse({
        title: 'İşlem Başarısız',
        textLines: [errorMsg || 'İşlem sırasında beklenmeyen bir hata oluştu.'],
        color: COLORS.ERROR || '#ED4245'
    });
    payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

    try {
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply(payload).catch(async () => {
                await interaction.followUp(payload).catch(() => {});
            });
        } else if (interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(async () => {
                await interaction.followUp(payload).catch(() => {});
            });
        }
    } catch (e) {
        console.error(`[sendInteractionErrorResponse] Yanıt hatası (${source}):`, e.message);
    }
}

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

        // --- ULTIMATE AUDIT LOGGING (HER ETKİLEŞİMİ KAYDET) ---
        try {
            const { MONO_EMOJIS, createContainerMessage } = require('../utils/uiBuilder');
            const db = require('../db');
            
            let actionType = 'Bilinmeyen Islem';
            let detail = '';
            let emojiKey = MONO_EMOJIS.info || '1530917515227725834';

            if (interaction.isCommand()) {
                actionType = `Komut Kullanimi: /${interaction.commandName}`;
                emojiKey = MONO_EMOJIS.command || MONO_EMOJIS.info || '1530917515227725834';
                const args = interaction.options.data.map(opt => `${opt.name}:${opt.value}`).join(', ');
                detail = args ? `Argumanlar: ${args}` : 'Arguman yok';
            } else if (interaction.isButton()) {
                actionType = `Butona Tiklandi`;
                emojiKey = MONO_EMOJIS.click || MONO_EMOJIS.info || '1530917515227725834';
                detail = `CustomID: \`${interaction.customId}\``;
            } else if (interaction.isStringSelectMenu()) {
                actionType = `Menu Secimi`;
                emojiKey = MONO_EMOJIS.list || MONO_EMOJIS.info || '1530917515227725834';
                detail = `CustomID: \`${interaction.customId}\`\nSecim: ${interaction.values.join(', ')}`;
            } else if (interaction.isModalSubmit()) {
                actionType = `Modal Gonderimi`;
                emojiKey = MONO_EMOJIS.form || MONO_EMOJIS.info || '1530917515227725834';
                detail = `CustomID: \`${interaction.customId}\``;
            }

            // Doğrudan log kanalına V2 formatında gönder
            const [rows] = await db.pool.query("SELECT log_channel_id FROM guild_config WHERE guild_id = ?", [interaction.guild.id]);
            if (rows.length > 0 && rows[0].log_channel_id) {
                const logCh = interaction.guild.channels.cache.get(rows[0].log_channel_id);
                if (logCh) {
                    const payload = createContainerMessage(
                        actionType,
                        `<:mono:${emojiKey}> **Kullanici:** <@${interaction.user.id}>\n**Kanal:** <#${interaction.channelId}>\n**Detay:**\n${detail}`,
                        '#3498DB'
                    );
                    await logCh.send({ ...payload, flags: 16384 }).catch(() => {}); // 16384 = MessageFlags.IsComponentsV2
                }
            }
        } catch (e) {
            console.error('Ultimate Audit Log Error:', e);
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
            const startTime = Date.now();
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                const durationMs = Date.now() - startTime;
                logCommandExecution({
                    interaction,
                    commandName: interaction.commandName,
                    durationMs,
                    success: false,
                    error: new Error(`Komut dosyası bot belleğinde bulunamadı (client.commands): ${interaction.commandName}`)
                });

                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    const notFoundPayload = buildModBResponse({
                        title: 'Komut Devre Dışı',
                        textLines: [`\`/${interaction.commandName}\` komutu şu anda sistemde yüklü değil veya devre dışı bırakılmış.`],
                        color: COLORS.ERROR || '#ED4245'
                    });
                    notFoundPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    await interaction.reply(notFoundPayload).catch(() => {});
                }
                return;
            }

            try {
                await command.execute(interaction, client);
                const durationMs = Date.now() - startTime;
                logCommandExecution({
                    interaction,
                    commandName: interaction.commandName,
                    durationMs,
                    success: true
                });
            } catch (error) {
                const durationMs = Date.now() - startTime;
                console.error(`[Komut Hatası] /${interaction.commandName}:`, error);

                // commands.log dosyasına ayrıntılı hata kaydet
                logCommandExecution({
                    interaction,
                    commandName: interaction.commandName,
                    durationMs,
                    success: false,
                    error
                });

                try {
                    const { buildWrongUsageContainer } = require('../utils/commandUsageHelper');
                    let desc = error.message || 'Bilinmeyen bir hata oluştu.';
                    if (error.message && error.message.includes('Missing Permissions')) {
                        desc = 'Botun bu işlemi gerçekleştirmek için yeterli Discord yetkisi bulunmuyor.';
                    }
                    const payload = buildWrongUsageContainer(command.data, '/', desc);
                    payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

                    if (interaction.deferred && !interaction.replied) {
                        await interaction.editReply(payload).catch(e => console.error('Silent catch editReply:', e.message));
                    } else if (interaction.replied) {
                        await interaction.followUp(payload).catch(e => console.error('Silent catch followUp:', e.message));
                    } else if (interaction.isRepliable()) {
                        await interaction.reply(payload).catch(e => console.error('Silent catch reply:', e.message));
                    }
                } catch (recoveryErr) {
                    console.error('[Hata Bildirimi Gönderilemedi]:', recoveryErr);
                    if (interaction.isRepliable()) {
                        const fallbackMsg = buildModBResponse({
                            title: 'Komut Hatası',
                            textLines: [`Komut çalıştırılırken bir hata oluştu: \`${error.message}\``],
                            color: COLORS.ERROR || '#ED4245'
                        });
                        fallbackMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                        if (interaction.deferred && !interaction.replied) await interaction.editReply(fallbackMsg).catch(()=>{});
                        else if (!interaction.replied) await interaction.reply(fallbackMsg).catch(()=>{});
                    }
                }
            }
            return;
        }

        // --- STATELESS ROUTING ---
        if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;

        // Özel Oda (Private Room) Yönlendirmesi
        try {
            const { handlePrivateRoomInteraction } = require('../utils/privateRoomInteractionHandler');
            const roomHandled = await handlePrivateRoomInteraction(interaction, client);
            if (roomHandled) return;
        } catch (err) {
            console.error("Private room interaction error:", err);
            logCommandExecution({
                interaction,
                commandName: `room_btn:${interaction.customId}`,
                durationMs: 0,
                success: false,
                error: err
            });
        }

        // AutoMod (Koruma & Filtre) Yönlendirmesi
        try {
            const { handleAutoModInteraction } = require('../utils/automodInteractionHandler');
            const automodHandled = await handleAutoModInteraction(interaction, client);
            if (automodHandled) return;
        } catch (err) {
            console.error("AutoMod interaction error:", err);
            logCommandExecution({
                interaction,
                commandName: `automod:${interaction.customId}`,
                durationMs: 0,
                success: false,
                error: err
            });
        }

        // Seviye Sistemi (Level / XP) Yönlendirmesi
        if (interaction.customId.startsWith('level_')) {
            const { handleLevelInteraction } = require('../utils/levelManager');
            try {
                const levelHandled = await handleLevelInteraction(interaction, client);
                if (levelHandled) return;
            } catch (err) {
                console.error("Level interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Seviye sistemi işlemi sırasında bir hata oluştu.', err, 'LEVEL');
                return;
            }
        }

        // Günlük Görevler (Quest) Yönlendirmesi
        if (interaction.customId.startsWith('quest_')) {
            const { handleQuestInteraction } = require('../utils/questManager');
            try {
                const questHandled = await handleQuestInteraction(interaction, client);
                if (questHandled) return;
            } catch (err) {
                console.error("Quest interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Günlük görevler işlemi sırasında bir hata oluştu.', err, 'QUEST');
                return;
            }
        }

        // Liderlik Tablosu (Top) Yönlendirmesi
        if (interaction.customId.startsWith('top_')) {
            const { handleTopInteraction } = require('../commands/utility/top');
            try {
                const topHandled = await handleTopInteraction(interaction, client);
                if (topHandled) return;
            } catch (err) {
                console.error("Top interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Liderlik tablosu işlemi sırasında bir hata oluştu.', err, 'TOP');
                return;
            }
        }

        // Güvenlik Panelleri (Auto-Bump & Vanity) Yönlendirmesi
        if (interaction.customId.startsWith('sec_')) {
            const { handleSecurityPanelInteraction } = require('../utils/securityPanelHandler');
            try {
                const secHandled = await handleSecurityPanelInteraction(interaction, client);
                if (secHandled) return;
            } catch (err) {
                console.error("Security panel interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Güvenlik paneli işlemi sırasında bir hata oluştu.', err, 'SECURITY');
                return;
            }
        }

        // Rol Bilgi (Role Info) Paneli Yönlendirmesi
        if (interaction.customId.startsWith('rolbilgi_')) {
            const { handleRoleInfoInteraction } = require('../commands/utility/rol-bilgi');
            try {
                const rolHandled = await handleRoleInfoInteraction(interaction);
                if (rolHandled) return;
            } catch (err) {
                console.error("Role info interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Rol bilgi işlemi sırasında bir hata oluştu.', err, 'ROLEINFO');
                return;
            }
        }

        // Dışa Aktarma Paneli (Dump) Yönlendirmesi
        if (interaction.customId.startsWith('dump_')) {
            const { handleDumpInteraction, handleDumpBack } = require('../commands/moderation/dump');
            try {
                if (await handleDumpInteraction(interaction)) return;
                if (await handleDumpBack(interaction)) return;
            } catch (err) {
                console.error("Dump panel interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Dışa aktarma işlemi sırasında bir hata oluştu.', err, 'DUMP');
                return;
            }
        }

        // Mesaj Temizleme Paneli (Purge) Yönlendirmesi
        if (interaction.customId.startsWith('purge_')) {
            const { handlePurgeInteraction } = require('../commands/moderation/purge');
            try {
                if (await handlePurgeInteraction(interaction)) return;
            } catch (err) {
                console.error("Purge panel interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Mesaj temizleme işlemi sırasında bir hata oluştu.', err, 'PURGE');
                return;
            }
        }

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
                await sendInteractionErrorResponse(interaction, 'Karşılama sistemi işlemi sırasında bir hata oluştu.', err, 'WELCOME');
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
                await sendInteractionErrorResponse(interaction, 'Çekiliş işlemi sırasında bir hata oluştu.', err, 'GIVEAWAY');
                return;
            }
        }

        // Gelişmiş Log Sistemi Yönlendirmesi
        if (interaction.customId.startsWith('log_')) {
            const { handleLogInteraction } = require('../utils/logInteractionHandler');
            try {
                await handleLogInteraction(interaction, client);
            } catch (err) {
                console.error("Log interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Log sistemi işlemi sırasında bir hata oluştu.', err, 'LOG');
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
                await sendInteractionErrorResponse(interaction, 'Müzik butonu işlemi sırasında bir hata oluştu.', err, 'MUSIC');
            }
            return;
        }

        // Roleplay Buton Yönlendirmesi
        if (interaction.customId.startsWith('rp_back_')) {
            const { handleRoleplayInteraction } = require('../utils/roleplayInteractionHandler');
            try {
                await handleRoleplayInteraction(interaction);
            } catch (err) {
                console.error("Roleplay interaction error:", err);
                await sendInteractionErrorResponse(interaction, 'Roleplay menüsü işlemi sırasında bir hata oluştu.', err, 'ROLEPLAY');
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
                    const payload = helpEmbedHome(interaction.guild, interaction.user, [createHelpComponents('home', interaction.member)], interaction.member);
                    return await interaction.editReply(payload).catch(err => console.error('[Yardım] editReply hatası:', err.message));
                }
                
                const payload = getCategoryHelpPayload(val, interaction.member);
                if (payload) {
                    return await interaction.editReply(payload).catch(err => console.error('[Yardım] editReply hatası:', err.message));
                }
            } catch (err) {
                console.error('[Yardım] Etkileşim hatası:', err);
                await sendInteractionErrorResponse(interaction, 'Yardım rehberi yüklenirken bir hata oluştu.', err, 'HELP');
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
                await sendInteractionErrorResponse(interaction, 'Destek talebi işlemi sırasında bir hata oluştu.', err, 'TICKET');
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
                await sendInteractionErrorResponse(interaction, 'Öneri sistemi işlemi sırasında bir hata oluştu.', err, 'ONERI');
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
                await sendInteractionErrorResponse(interaction, 'Yetkili panosu işlemi sırasında bir hata oluştu.', err, 'STAFF_PANEL');
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
                await sendInteractionErrorResponse(interaction, 'Prefix ayarları işlemi sırasında bir hata oluştu.', err, 'PREFIX');
            }
            return;
        }

        // --- ECONOMY (EKONOMİ) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('eco_')) {
            const { handleEconomyInteractions } = require('../utils/economyHandler');
            try {
                await handleEconomyInteractions(interaction);
            } catch (err) {
                console.error('Economy interaction error:', err);
            }
            return;
        }

        // --- POLLS (ANKET) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('poll_')) {
            const { handlePollInteractions } = require('../utils/pollHandler');
            try {
                await handlePollInteractions(interaction);
            } catch (err) {
                console.error('Poll interaction error:', err);
            }
            return;
        }

        // --- REACTION ROLES (TEPKİ ROLÜ) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('rr_')) {
            const { handleReactionRoles } = require('../utils/reactionRoleHandler');
            try {
                await handleReactionRoles(interaction);
            } catch (err) {
                console.error('Reaction Role interaction error:', err);
                await sendInteractionErrorResponse(interaction, 'Rol işlemi sırasında bir hata oluştu.', err, 'REACTION_ROLE');
            }
            return;
        }

        // --- ACHIEVEMENTS (BAŞARIM) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('ach_')) {
            const { handleAchievementInteractions } = require('../utils/achievements');
            try {
                await handleAchievementInteractions(interaction);
            } catch (err) {
                console.error('Achievement interaction error:', err);
            }
            return;
        }

        // --- REMINDERS (HATIRLATICI) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('rem_')) {
            const { handleReminderInteractions } = require('../utils/reminderHandler');
            try {
                await handleReminderInteractions(interaction);
            } catch (err) {
                console.error('Reminder interaction error:', err);
            }
            return;
        }

        // --- BIRTHDAYS (DOĞUM GÜNÜ) ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('bday_')) {
            const { handleBirthdayInteractions } = require('../utils/birthdayHandler');
            try {
                await handleBirthdayInteractions(interaction);
            } catch (err) {
                console.error('Birthday interaction error:', err);
            }
            return;
        }

        // --- SOCIAL (SOSYAL MEDYA) ROUTER ---
        if (interaction.customId && interaction.customId === 'social_refresh') {
            await interaction.deferUpdate().catch(() => {});
            try {
                const db = require('../db');
                const { createContainerMessage, MONO_EMOJIS } = require('../utils/uiBuilder');
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const subs = await db.pool.query('SELECT * FROM social_subscriptions WHERE guild_id = ?', [interaction.guild.id]);
                let list = '';
                for (const s of subs) {
                    list += `\`#${s.id}\` **${s.platform.toUpperCase()}**: ${s.channel_identifier} → <#${s.discord_channel_id}>\n`;
                }
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('social_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
                );
                await interaction.editReply(createContainerMessage('Aktif Bildirimler', list || 'Hiç aktif bildirimin yok.', '#5865F2', [row])).catch(() => {});
            } catch (err) {
                console.error('Social interaction error:', err);
            }
            return;
        }

        // --- FUN + GIF + HAYVAN ROUTER ---
        if (interaction.customId && (interaction.customId.startsWith('fun_') || interaction.customId.startsWith('roast_') || interaction.customId === 'fact_yeni' || interaction.customId === 'saat_yenile' || interaction.customId === 'kedi_yeni' || interaction.customId === 'kopek_yeni' || interaction.customId.startsWith('gif_'))) {
            try {
                if (interaction.customId.startsWith('gif_')) {
                    const { handleGifInteractions } = require('../utils/gifHandler');
                    await handleGifInteractions(interaction);
                } else {
                    const { handleFunInteractions } = require('../utils/funHandler');
                    await handleFunInteractions(interaction);
                }
            } catch (err) {
                console.error('Fun interaction error:', err);
            }
            return;
        }

        // --- OYUNLAR ROUTER (xox, sayı, kelime, asmaca, düello, zardüello, tkm, hızyaz, trivia, oylamalar) ---
        if (interaction.customId && ['ox_', 'sayi_', 'kelime_', 'asmaca_', 'duello_', 'zard_', 'tkm_', 'hizyaz_', 'trivia_', 'bumu_', 'basar_'].some(p => interaction.customId.startsWith(p))) {
            const { handleGameInteractions } = require('../utils/gameHandler');
            try {
                await handleGameInteractions(interaction);
            } catch (err) {
                console.error('Game interaction error:', err);
            }
            return;
        }

        // --- EKONOMİ-FUN ROUTER (slots, blackjack, crash, balık) ---
        if (interaction.customId && (interaction.customId.startsWith('slot_') || interaction.customId.startsWith('bj_') || interaction.customId.startsWith('crash_') || interaction.customId === 'fish_again')) {
            const { handleEcoFunInteractions } = require('../utils/ecofunHandler');
            try {
                await handleEcoFunInteractions(interaction);
            } catch (err) {
                console.error('EcoFun interaction error:', err);
            }
            return;
        }

        // --- KAYIT + DOĞRULAMA ROUTER ---
        if (interaction.customId && interaction.customId.startsWith('dogrula_')) {
            const { handleKayitInteractions } = require('../utils/kayitHandler');
            try {
                await handleKayitInteractions(interaction);
            } catch (err) {
                console.error('Dogrulama interaction error:', err);
            }
            return;
        }

        // --- TOPLULUK ROUTER (etkinlik, kurallar, oy) ---
        if (interaction.customId && (interaction.customId.startsWith('etk_') || interaction.customId === 'kural_kabul' || interaction.customId === 'oy_al')) {
            const { handleToplulukInteractions } = require('../utils/toplulukHandler');
            try {
                await handleToplulukInteractions(interaction);
            } catch (err) {
                console.error('Topluluk interaction error:', err);
            }
            return;
        }

        // --- YÖNETİM ROUTER (toplu rol) ---
        if (interaction.customId && interaction.customId.startsWith('toplu_')) {
            const { handleYonetimInteractions } = require('../utils/yonetimHandler');
            try {
                await handleYonetimInteractions(interaction);
            } catch (err) {
                console.error('Yonetim interaction error:', err);
            }
            return;
        }

        // --- BİLGİ ROUTER (yenile) ---
        if (interaction.customId && interaction.customId.startsWith('bilgi_yenile_')) {
            const { handleBilgiInteractions } = require('../utils/bilgiHandler');
            try {
                await handleBilgiInteractions(interaction);
            } catch (err) {
                console.error('Bilgi interaction error:', err);
            }
            return;
        }

        // --- EVLİLİK + AİLE + PROFİL ROUTER ---
        if (interaction.customId && (interaction.customId.startsWith('evlen_') || interaction.customId.startsWith('bosan_') || interaction.customId.startsWith('profil_yenile_') || interaction.customId.startsWith('aile_'))) {
            const { handleEvlenInteractions } = require('../utils/evlilikHandler');
            try {
                await handleEvlenInteractions(interaction);
            } catch (err) {
                console.error('Evlilik interaction error:', err);
            }
            return;
        }

        // --- KURULUM + ÖZELLEŞTİRME + NOT ROUTER ---
        if (interaction.customId && (interaction.customId.startsWith('ok_') || interaction.customId.startsWith('oz_') || interaction.customId === 'not_modal')) {
            const { handleKurulumInteractions } = require('../utils/kurulumHandler');
            try {
                await handleKurulumInteractions(interaction);
            } catch (err) {
                console.error('Kurulum interaction error:', err);
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
                await sendInteractionErrorResponse(interaction, 'Otorol işlemi sırasında bir hata oluştu.', err, 'AUTOROLE');
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
                await sendInteractionErrorResponse(interaction, 'Özel oda işlemi sırasında bir hata oluştu.', err, 'PRIVROOM');
            }
            return;
        }

        // MOD NAMESPACE
        if (namespace === 'mod') {
            const { PermissionFlagsBits, MessageFlags } = require('discord.js');
            const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../utils/uiBuilder');
            
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> Yetki Hatası`,
                    'Bu işlemi yapmak için yetkiniz yok.',
                    '#ED4245', [], [], false, true
                ));
            }

            if (action === 'mute') {
                try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { return; }
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    await member.timeout(10 * 60 * 1000, 'Buton üzerinden hızlı mute');
                    const payload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Susturuldu`,
                        `<@${targetId}> kullanıcısı 10 dakika susturuldu.`,
                        '#57F287'
                    );
                    payload.flags = MessageFlags.IsComponentsV2;
                    await interaction.editReply(payload).catch(e => console.error('Silent catch:', e.message));
                } catch (error) {
                    const errPayload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> İşlem Başarısız`,
                        'Kullanıcı bulunamadı veya yetkim yetersiz.',
                        '#ED4245'
                    );
                    errPayload.flags = MessageFlags.IsComponentsV2;
                    await interaction.editReply(errPayload).catch(e => console.error('Silent catch:', e.message));
                }
            } else if (action === 'ban') {
                try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { return; }
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    let conn;
                    try {
                        conn = await pool.getConnection();
                        const rows = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                        if (rows.length > 0 && rows[0].banned_role_id) {
                            await member.roles.add(rows[0].banned_role_id);
                            const payload = createContainerMessage(
                                `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Yasaklandı`,
                                `<@${targetId}> kullanıcısına yasaklı rolü verildi.`,
                                '#57F287'
                            );
                            payload.flags = MessageFlags.IsComponentsV2;
                            await interaction.editReply(payload).catch(e => console.error('Silent catch:', e.message));
                        } else {
                            const errPayload = createContainerMessage(
                                `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> Ayar Eksik`,
                                'Sunucuda yasaklı rolü ayarlanmamış.',
                                '#ED4245'
                            );
                            errPayload.flags = MessageFlags.IsComponentsV2;
                            await interaction.editReply(errPayload).catch(e => console.error('Silent catch:', e.message));
                        }
                    } finally { if (conn) conn.release(); }
                } catch (error) {
                    const errPayload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> İşlem Başarısız`,
                        'Kullanıcı bulunamadı veya yetkim yetersiz.',
                        '#ED4245'
                    );
                    errPayload.flags = MessageFlags.IsComponentsV2;
                    await interaction.editReply(errPayload).catch(e => console.error('Silent catch:', e.message));
                }
            } else if (action === 'ignore') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                await interaction.message.delete().catch(e => console.error('Silent catch:', e.message));
            }
        }
        
        // ISTATISTIK REFRESH
        if (action === 'istatistik_refresh') {
            try { await interaction.deferUpdate(); } catch (e) { return; }
            const payload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Menü Güncelleme`,
                'Bu istatistik menüsü eski sürümdedir. Lütfen `/istatistik` komutunu tekrar çalıştırın.',
                '#5865F2'
            );
            payload.flags = MessageFlags.IsComponentsV2;
            await interaction.editReply(payload).catch(() => {});
        }

        // YETKİLİ BAŞVURU (APP SYSTEM)
        if (action.startsWith('app_') || action === 'staff_apply_btn' || action === 'staff_apply_submit') {
            const { handleApplicationInteraction } = require('../utils/applicationSystem');
            try {
                await handleApplicationInteraction(interaction, action);
            } catch (err) {
                console.error('App interaction err:', err);
                await sendInteractionErrorResponse(interaction, 'Yetkili başvurusu işlemi sırasında bir hata oluştu.', err, 'APPLICATION');
            }
            return;
        }

        // İÇERİK ÜRETİCİ BAŞVURU (CREATOR SYSTEM)
        if (namespace !== 'sorgu' && action.startsWith('creator_')) {
            const { handleCreatorInteraction } = require('../utils/creatorApplicationSystem');
            try {
                await handleCreatorInteraction(interaction, action);
            } catch (err) {
                console.error('Creator interaction err:', err);
                await sendInteractionErrorResponse(interaction, 'İçerik üretici başvurusu işlemi sırasında bir hata oluştu.', err, 'CREATOR_APP');
            }
            return;
        }

        // SORGU NAMESPACE
        if (namespace === 'sorgu') {
            const { PermissionFlagsBits } = require('discord.js');
            const { createContainerMessage, MONO_EMOJIS } = require('../utils/uiBuilder');

            if (action === 'select') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                return handleSorguSelect(interaction, interaction.values[0], targetId);
            }
            if (action === 'creator_pick') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                return handleSorguSelect(interaction, interaction.values[0], targetId);
            }
            if (action === 'creator_back') {
                try { await interaction.deferUpdate(); } catch (e) { return; }
                return handleSorguSelect(interaction, 'sorgu_creator_apps', targetId);
            }
            if (action.startsWith('export_')) {
                const exportType = action.replace('export_', '');
                return handleExport(interaction, exportType, targetId);
            }
            if (action === 'transcript_picker') {
                try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { return; }
                const rawTicketId = interaction.values[0].replace('sorgu:transcript:', '');
                const ticketId = parseInt(rawTicketId, 10);
                if (!ticketId || isNaN(ticketId)) {
                    const errPayload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> Geçersiz Numara`,
                        'Geçersiz bilet numarası belirtildi.',
                        '#ED4245'
                    );
                    errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return interaction.editReply(errPayload);
                }
                let conn;
                try {
                    conn = await pool.getConnection();
                    const rows = await conn.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
                    if (rows.length === 0) {
                        const errPayload = createContainerMessage(
                            `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> Döküm Bulunamadı`,
                            'Bu talebe ait transkript kaydı bulunamadı.',
                            '#ED4245'
                        );
                        errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                        return interaction.editReply(errPayload);
                    }
                    const ticket = rows[0];
                    if (ticket.owner_id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                        const errPayload = createContainerMessage(
                            `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> Yetki Yetersiz`,
                            'Bu bilet dökümünü görüntüleme yetkiniz yok.',
                            '#ED4245'
                        );
                        errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                        return interaction.editReply(errPayload);
                    }
                    const dbMsgs = await conn.query('SELECT * FROM ticket_messages WHERE channel_id = ? ORDER BY created_at ASC', [ticket.channel_id]);

                    const htmlContent = await generateDiscordTranscriptHtml({ guild: interaction.guild, channel: { name: `destek-${ticket.owner_tag || 'kullanıcı'}` }, messages: dbMsgs || [], ticketData: ticket });
                    const textContent = generateDiscordTranscriptText({ guild: interaction.guild, channel: { name: `destek-${ticket.owner_tag || 'kullanıcı'}` }, messages: dbMsgs || [], ticketData: ticket });
                    const channelSlug = ticket.owner_tag ? `destek-${ticket.owner_tag}` : 'destek';
                    const files = [
                        new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `ticket-#${ticket.id}-${channelSlug}.html` }),
                        new AttachmentBuilder(Buffer.from(textContent, 'utf-8'), { name: `ticket-#${ticket.id}-${channelSlug}.txt` })
                    ];
                    const successPayload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.ticket || '1530918960764027000'}> Ticket #${ticket.id} Transcript`,
                        `**Ticket #${ticket.id}** ait HTML & Metin transcript dökümü ekteki dosyalardadır:`,
                        '#5865F2'
                    );
                    successPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    successPayload.files = files;
                    return interaction.editReply(successPayload);
                } catch (err) {
                    const errPayload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917536806469783'}> Sistem Hatası`,
                        'Transcript alınırken sistemsel bir hata oluştu.',
                        '#ED4245'
                    );
                    errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    await interaction.editReply(errPayload);
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
                        const okPayload = createContainerMessage(
                            `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Kayıt Silindi`,
                            `#${recordId} (${type}) kaydı başarıyla silindi (pasife alındı).`,
                            '#57F287'
                        );
                        okPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                        await interaction.followUp(okPayload).catch(e => console.error('Silent catch:', e.message));

                        // Menüyü yenile
                        try {
                            const warns = await conn.query('SELECT id, reason, created_at, moderator_id, "warn" as type FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUserId]);
                            const mutes = await conn.query('SELECT id, reason, created_at, moderator_id, action_type as type FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUserId]);
                            
                            const allRecords = [...warns, ...mutes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 25);

                            if (allRecords.length === 0) {
                                const { createV2Message, COLORS } = require('../utils/uiBuilder');
                                await interaction.editReply(createV2Message({
                                    title: 'Ceza / Uyarı Kaldırma (Pasife Alma)',
                                    description: `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **<@${targetUserId}>** kullanıcısının aktif tüm cezaları/uyarıları silindi.`,
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
                        await sendInteractionErrorResponse(interaction, `Ceza kaydı silinirken hata oluştu: ${e.message}`, e, 'SORGU_REMOVE');
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

        // Catch-all: Eğer hiçbir handler cevap vermediyse veya deferred kalmışsa, timeout ve "yanıt vermedi" hatasını engelle
        if (!interaction.replied && !interaction.deferred) {
            if (interaction.isRepliable()) {
                const payload = buildModBResponse({
                    title: 'İşlem Geçersiz',
                    textLines: ['Bu buton, menü veya modal artık aktif değil veya süresi dolmuş.'],
                    color: COLORS.WARNING || '#FEE75C'
                });
                payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.reply(payload).catch(() => {});
            }
        } else if (interaction.deferred && !interaction.replied) {
            if (interaction.isRepliable()) {
                const payload = buildModBResponse({
                    title: 'İşlem Tamamlanamadı',
                    textLines: ['İsteğiniz işlenirken bir sorun oluştu veya zaman aşımına uğradı.'],
                    color: COLORS.ERROR || '#ED4245'
                });
                payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(payload).catch(() => {});
            }
        }
    }
};
