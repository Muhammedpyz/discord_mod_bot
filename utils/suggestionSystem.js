// Dynamic V2 Suggestion System (Öneri Sistemi) - 100% matched to UI Screenshots & MONO emojis
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder,
    MessageFlags
} = require('discord.js');
const { buildModBResponse, MONO_EMOJIS } = require('./uiBuilder');
const { pool } = require('../db');

const suggestionCooldowns = new Map();

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

function selectedChannelId(interaction, customId) {
    try {
        const channels = interaction.fields.getSelectedChannels(customId, false);
        return channels?.first()?.id || null;
    } catch(e) {
        return null;
    }
}

// -------------------------------------------------------------
// Database Operations
// -------------------------------------------------------------
async function getSuggestionSetup(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM suggestion_setup WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            return rows[0];
        }
        return {
            guild_id: guildId,
            panel_channel_id: null,
            suggestion_channel_id: null,
            log_channel_id: null,
            cooldown_seconds: 30,
            panel_title: '',
            panel_description: '',
            is_active: 1,
            published_message_id: null
        };
    } catch(err) {
        console.error('getSuggestionSetup error:', err);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function saveSuggestionSetup(setup) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO suggestion_setup 
            (guild_id, panel_channel_id, suggestion_channel_id, log_channel_id, cooldown_seconds, panel_title, panel_description, is_active, published_message_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            panel_channel_id=VALUES(panel_channel_id),
            suggestion_channel_id=VALUES(suggestion_channel_id),
            log_channel_id=VALUES(log_channel_id),
            cooldown_seconds=VALUES(cooldown_seconds),
            panel_title=VALUES(panel_title),
            panel_description=VALUES(panel_description),
            is_active=VALUES(is_active),
            published_message_id=VALUES(published_message_id)
        `, [
            setup.guild_id,
            setup.panel_channel_id || null,
            setup.suggestion_channel_id || null,
            setup.log_channel_id || null,
            setup.cooldown_seconds !== undefined ? setup.cooldown_seconds : 30,
            setup.panel_title || null,
            setup.panel_description || null,
            setup.is_active !== undefined ? setup.is_active : 1,
            setup.published_message_id || null
        ]);
    } catch(err) {
        console.error('saveSuggestionSetup error:', err);
    } finally {
        if (conn) conn.release();
    }
}

// -------------------------------------------------------------
// 1. Admin Dashboard View
// -------------------------------------------------------------
async function renderSuggestionAdminMenu(guildId) {
    const setup = await getSuggestionSetup(guildId);

    const eFolder = getMonoEmoji('folder');
    const eMsg = getMonoEmoji('message_circle');
    const eLog = getMonoEmoji('file_text');
    const eClock = getMonoEmoji('timer_off');

    const panelText = setup?.panel_channel_id ? `<#${setup.panel_channel_id}>` : 'ayarlanmadı';
    const publishText = setup?.suggestion_channel_id ? `<#${setup.suggestion_channel_id}>` : 'ayarlanmadı';
    const logText = setup?.log_channel_id ? `<#${setup.log_channel_id}>` : 'ayarlanmadı';
    const cooldownText = setup?.cooldown_seconds === 0 ? 'Kapalı (0 saniye)' : `${setup?.cooldown_seconds ?? 30} saniye`;

    const statusLines = [
        `${eFolder} **Öneri paneli** › ${panelText}`,
        `${eMsg} **Önerilerin yayınlanacağı kanal** › ${publishText}`,
        `${eLog} **Gizli öneri logu** › ${logText}`,
        `${eClock} **Gönderim aralığı** › ${cooldownText}`
    ];

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('oneri_admin_channels').setLabel('Kanalları Ayarla').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.settings),
        new ButtonBuilder().setCustomId('oneri_admin_look').setLabel('Görünümü Düzenle').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.brush)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('oneri_admin_cooldown').setLabel('Gönderim Süresi').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.timer_off),
        new ButtonBuilder().setCustomId('oneri_admin_publish').setLabel('Paneli Yayınla').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.announcement)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('oneri_admin_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw),
        new ButtonBuilder().setCustomId('oneri_admin_disable').setLabel('Sistemi Kapat').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete)
    );

    return buildModBResponse({
        title: 'Öneri Sistemi',
        textLines: [
            'Topluluğunun fikirlerini tek bir şık panelden topla; isteyen adını gösterir, isteyen anonim kalır. Öneriler oylanır, gerçek gönderen yalnızca gizli logda görünür.',
            'Üyelerin sunucu için fikirlerini iletebileceği, diğer üyelerin oy verebileceği öneri sistemini buradan kurup yönetebilirsin.',
            '---SEPARATOR---',
            ...statusLines,
            '---SEPARATOR---',
            isReady 
                ? 'Sistem yayına hazır. Paneli göndermek için **Paneli Yayınla** butonuna bas.'
                : 'Başlamak için önce **Kanallar** butonundan gerekli kanalları seç.'
        ],
        actionRows: [row1, row2]
    });
}

// Sub-view: "Öneri Kanalları"
async function renderSuggestionChannelsView(guildId) {
    const setup = await getSuggestionSetup(guildId);

    const rowPanel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('oneri_sel_panel_channel')
            .setPlaceholder('Öneri paneli kanalı seçin')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowSuggestion = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('oneri_sel_suggestion_channel')
            .setPlaceholder('Öneriler (oylama) kanalı seçin')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowLog = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('oneri_sel_log_channel')
            .setPlaceholder('Gizli öneri log kanalı seçin (isteğe bağlı)')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('oneri_admin_refresh').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530917536806469783')
    );

    const pChan = setup.panel_channel_id ? `<#${setup.panel_channel_id}>` : 'Seçilmedi';
    const sChan = setup.suggestion_channel_id ? `<#${setup.suggestion_channel_id}>` : 'Seçilmedi';
    const lChan = setup.log_channel_id ? `<#${setup.log_channel_id}>` : 'Kapalı';

    return buildModBResponse({
        title: 'Öneri Kanalları Ayarları',
        textLines: [
            'Aşağıdaki menülerden öneri panelinin ve gelen önerilerin yayınlanacağı kanalları belirleyin.',
            '---SEPARATOR---',
            `**Panel Kanalı:** ${pChan}`,
            `**Öneriler Kanalı:** ${sChan}`,
            `**Log Kanalı:** ${lChan}`
        ],
        actionRows: [rowPanel, rowSuggestion, rowLog, rowBtns]
    });
}

// "Öneri Paneli Görünümü" Modal
function buildLookModal(setup) {
    const modal = new ModalBuilder().setCustomId('oneri_modal_look').setTitle('Öneri Paneli Görünümü');
    const titleInput = new TextInputBuilder()
        .setCustomId('panel_title')
        .setLabel('Panel Başlığı')
        .setPlaceholder('Boş bırakırsan hazır başlık kullanılır')
        .setStyle(TextInputStyle.Short)
        .setValue(setup.panel_title || '')
        .setRequired(false)
        .setMaxLength(80);
    const descInput = new TextInputBuilder()
        .setCustomId('panel_description')
        .setLabel('Panel Açıklaması')
        .setPlaceholder('Üyelere ne tür fikirler beklediğinizi anlatın')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(setup.panel_description || '')
        .setRequired(false)
        .setMaxLength(1000);
    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput)
    );
    return modal;
}

// "Öneri Gönderim Ayarları" Modal
function buildCooldownModal(setup) {
    const modal = new ModalBuilder().setCustomId('oneri_modal_cooldown').setTitle('Öneri Gönderim Ayarları');
    const cooldownInput = new TextInputBuilder()
        .setCustomId('cooldown_seconds')
        .setLabel('İki öneri arasındaki süre (saniye)')
        .setPlaceholder('0-86400 arasında bir tam sayı yazın')
        .setStyle(TextInputStyle.Short)
        .setValue(String(setup.cooldown_seconds !== undefined ? setup.cooldown_seconds : 30))
        .setRequired(true)
        .setMaxLength(6);
    modal.addComponents(new ActionRowBuilder().addComponents(cooldownInput));
    return modal;
}

// "Önerini Paylaş" Modal
function buildUserSubmitModal() {
    const modal = new ModalBuilder().setCustomId('oneri_modal_user_submit').setTitle('Önerini Paylaş');
    const textInput = new TextInputBuilder()
        .setCustomId('suggestion_text')
        .setLabel('Öneriniz')
        .setPlaceholder('Neyi, neden ve nasıl değiştirmek istediğinizi anlatın...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1500);
    const anonInput = new TextInputBuilder()
        .setCustomId('anonymous_text')
        .setLabel('Anonim Gönderilsin mi? (Evet / Hayır)')
        .setPlaceholder('Anonim olması için Evet yazın (varsayılan: Hayır)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10);
    modal.addComponents(
        new ActionRowBuilder().addComponents(textInput),
        new ActionRowBuilder().addComponents(anonInput)
    );
    return modal;
}

// -------------------------------------------------------------
// 3. Main Interaction Handler
// -------------------------------------------------------------
async function handleSuggestionInteraction(interaction) {
    const customId = interaction.customId;
    const guildId = interaction.guild?.id;

    // --- Admin Dashboard Actions ---
    if (customId === 'oneri_admin_refresh') {
        const menu = await renderSuggestionAdminMenu(guildId);
        await interaction.update(menu);
    }
    else if (customId === 'oneri_admin_channels') {
        await interaction.deferUpdate();
        const view = await renderSuggestionChannelsView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'oneri_sel_panel_channel') {
        await interaction.deferUpdate();
        const setup = await getSuggestionSetup(guildId);
        setup.panel_channel_id = interaction.values[0];
        await saveSuggestionSetup(setup);
        const view = await renderSuggestionChannelsView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'oneri_sel_suggestion_channel') {
        await interaction.deferUpdate();
        const setup = await getSuggestionSetup(guildId);
        setup.suggestion_channel_id = interaction.values[0];
        await saveSuggestionSetup(setup);
        const view = await renderSuggestionChannelsView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'oneri_sel_log_channel') {
        await interaction.deferUpdate();
        const setup = await getSuggestionSetup(guildId);
        setup.log_channel_id = interaction.values[0];
        await saveSuggestionSetup(setup);
        const view = await renderSuggestionChannelsView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'oneri_admin_look') {
        const setup = await getSuggestionSetup(guildId);
        await interaction.showModal(buildLookModal(setup));
    }
    else if (customId === 'oneri_modal_look') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getSuggestionSetup(guildId);
        setup.panel_title = interaction.fields.getTextInputValue('panel_title')?.trim() || '';
        setup.panel_description = interaction.fields.getTextInputValue('panel_description')?.trim() || '';
        await saveSuggestionSetup(setup);
        await interaction.editReply(await renderSuggestionAdminMenu(guildId));
    }
    else if (customId === 'oneri_admin_cooldown') {
        const setup = await getSuggestionSetup(guildId);
        await interaction.showModal(buildCooldownModal(setup));
    }
    else if (customId === 'oneri_modal_cooldown') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getSuggestionSetup(guildId);
        const cd = parseInt(interaction.fields.getTextInputValue('cooldown_seconds'), 10);
        setup.cooldown_seconds = (!isNaN(cd) && cd >= 0 && cd <= 86400) ? cd : 30;
        await saveSuggestionSetup(setup);
        await interaction.editReply(await renderSuggestionAdminMenu(guildId));
    }
    else if (customId === 'oneri_admin_publish') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getSuggestionSetup(guildId);
        if (!setup.panel_channel_id || !setup.suggestion_channel_id) {
            return await interaction.editReply(buildModBResponse({
                title: 'Eksik Kurulum',
                textLines: ['Lütfen önce **Kanalları Ayarla** butonundan Öneri Paneli ve Yayın kanalını seçin.']
            }));
        }

        const panelChannel = await interaction.guild.channels.fetch(setup.panel_channel_id).catch(() => null);
        if (!panelChannel) {
            return await interaction.editReply(buildModBResponse({
                title: 'Hata',
                textLines: ['Öneri paneli kanalı bulunamadı.']
            }));
        }

        const submitBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('oneri_user_submit_btn')
                .setLabel('Öneri Yap')
                .setStyle(ButtonStyle.Success)
                .setEmoji(MONO_EMOJIS.file_text)
        );

        const defaultTitle = setup.panel_title || 'Öneri Paneli';
        const defaultDesc = setup.panel_description || 'Topluluğumuzun gelişmesine katkıda bulunmak için fikirlerini paylaşabilirsin. İstersen adını gösterebilir veya tamamen anonim kalabilirsin!';

        const panelPayload = buildModBResponse({
            title: defaultTitle,
            textLines: [
                defaultDesc,
                '---SEPARATOR---',
                '-# Aşağıdaki butona tıklayarak açılan form üzerinden önerinizi hemen iletebilirsiniz.'
            ],
            actionRows: [submitBtn]
        });

        const sent = await panelChannel.send(panelPayload);
        setup.published_message_id = sent.id;
        setup.is_active = 1;
        await saveSuggestionSetup(setup);

        await interaction.editReply(await renderSuggestionAdminMenu(guildId));
    }
    else if (customId === 'oneri_admin_disable') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getSuggestionSetup(guildId);
        setup.is_active = 0;
        await saveSuggestionSetup(setup);
        await interaction.editReply(await renderSuggestionAdminMenu(guildId));
    }

    // --- User Submission Flows ---
    else if (customId === 'oneri_user_submit_btn') {
        await interaction.showModal(buildUserSubmitModal());
    }
    else if (customId === 'oneri_modal_user_submit') {
        await handleUserSuggestionSubmit(interaction);
    }

    // --- Voting Actions ---
    else if (customId.startsWith('oneri_vote_up:') || customId.startsWith('oneri_vote_down:')) {
        await handleSuggestionVote(interaction);
    }
}

// -------------------------------------------------------------
// 4. User Suggestion Processor (Exact match with Screenshot 5)
// -------------------------------------------------------------
async function handleUserSuggestionSubmit(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;
    const setup = await getSuggestionSetup(guild.id);

    // Cooldown check
    const cooldownKey = `${guild.id}:${user.id}`;
    const lastTime = suggestionCooldowns.get(cooldownKey);
    const cooldownSec = setup.cooldown_seconds !== undefined ? setup.cooldown_seconds : 30;
    const cooldownMs = cooldownSec * 1000;

    if (cooldownSec > 0 && lastTime && Date.now() < lastTime + cooldownMs) {
        const remaining = Math.ceil((lastTime + cooldownMs - Date.now()) / 1000);
        const waitPayload = buildModBResponse({
            title: 'Lütfen Bekleyin',
            textLines: [`${getMonoEmoji('clock')} Çok hızlı öneri gönderiyorsunuz. Lütfen **${remaining} saniye** bekleyin.`]
        });
        waitPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        return await interaction.reply(waitPayload);
    }

    const text = interaction.fields.getTextInputValue('suggestion_text')?.trim();
    let isAnon = false;
    try {
        const anonInput = interaction.fields.getTextInputValue('anonymous_text');
        if (anonInput && (anonInput.toLowerCase().includes('evet') || anonInput.toLowerCase().includes('yes') || anonInput.toLowerCase().includes('true') || anonInput.toLowerCase().includes('1'))) {
            isAnon = true;
        }
    } catch(e) {}

    if (!setup.suggestion_channel_id) {
        const errPayload = buildModBResponse({
            title: 'Ayar Eksik',
            textLines: ['Öneri yayın kanalı henüz ayarlanmamış. Lütfen yetkililere bildirin.']
        });
        errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        return await interaction.reply(errPayload);
    }

    const targetChannel = await guild.channels.fetch(setup.suggestion_channel_id).catch(() => null);
    if (!targetChannel) {
        const notFoundPayload = buildModBResponse({
            title: 'Kanal Bulunamadı',
            textLines: ['Öneri yayın kanalı sunucuda bulunamadı. Lütfen yetkililere bildirin.']
        });
        notFoundPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        return await interaction.reply(notFoundPayload);
    }

    if (cooldownSec > 0) {
        suggestionCooldowns.set(cooldownKey, Date.now());
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query(
            'INSERT INTO suggestions (guild_id, user_id, content, is_anonymous, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [guild.id, user.id, text, isAnon ? 1 : 0, 'pending']
        );
        const suggestionId = res.insertId;
        const paddedId = String(suggestionId).padStart(4, '0');

        const { trackSuggestionQuest } = require('./questManager');
        trackSuggestionQuest(guild.id, user.id).catch(() => {});

        // Screenshot-matching Public Card:
        // Title: <:mono:vote> Öneri
        // Content: > ${text}
        // Meta: <:mono:id_card> Öneri No: #0001
        //       <:mono:user> Gönderen: Anonim
        //       <:mono:clock> Gönderildi: 10 saniye önce
        // Buttons: [➕ 0 (Success)] [➖ 0 (Danger)]
        const eVote = getMonoEmoji('vote');
        const eId = getMonoEmoji('id_card');
        const eUser = getMonoEmoji('user');
        const eClock = getMonoEmoji('clock');

        const submitterText = isAnon ? 'Anonim' : `<@${user.id}>`;
        const timeNow = Math.floor(Date.now() / 1000);

        const rowVote = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`oneri_vote_up:${suggestionId}`).setLabel('0').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.plus),
            new ButtonBuilder().setCustomId(`oneri_vote_down:${suggestionId}`).setLabel('0').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.minus)
        );

        const publicPayload = buildModBResponse({
            title: `${eVote} Öneri`,
            textLines: [
                `> ${text}`,
                '---SEPARATOR---',
                `${eId} **Öneri No:** #${paddedId}\n${eUser} **Gönderen:** ${submitterText}\n${eClock} **Gönderildi:** <t:${timeNow}:R>`
            ],
            actionRows: [rowVote]
        });

        const publicMsg = await targetChannel.send(publicPayload);
        await conn.query('UPDATE suggestions SET message_id = ? WHERE id = ?', [publicMsg.id, suggestionId]);

        // Screenshot-matching Secret Log Card:
        // Title: <:mono:file_text> Yeni Öneri Kaydı · #1
        // Meta: <:mono:user> Gerçek gönderen › @User (ID)
        //       <:mono:shield> Herkese açık görünüm › Anonim
        //       <:mono:clock> Gönderim zamanı › Cumartesi, 15 Ağustos 2026 01:13
        // Content: > ${text}
        // Button: [🔗 Öneriye Git]
        if (setup.log_channel_id) {
            const logChannel = await guild.channels.fetch(setup.log_channel_id).catch(() => null);
            if (logChannel) {
                const eShield = getMonoEmoji('shield');
                const eLog = getMonoEmoji('file_text');
                const logRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Öneriye Git').setStyle(ButtonStyle.Link).setURL(publicMsg.url).setEmoji(MONO_EMOJIS.external_link)
                );

                const logPayload = buildModBResponse({
                    title: `${eLog} Yeni Öneri Kaydı · #${suggestionId}`,
                    textLines: [
                        `${eUser} **Gerçek gönderen ›** <@${user.id}>\n(\`${user.id}\`)\n${eShield} **Herkese açık görünüm ›** ${isAnon ? 'Anonim' : 'Açık'}\n${eClock} **Gönderim zamanı ›** <t:${timeNow}:F>`,
                        '---SEPARATOR---',
                        `> ${text}`
                    ],
                    actionRows: [logRow]
                });
                await logChannel.send(logPayload).catch(() => {});
            }
        }

        const successPayload = buildModBResponse({
            title: 'Öneri Gönderildi',
            textLines: [`${getMonoEmoji('check')} Öneriniz başarıyla yayınlandı!`]
        });
        successPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.reply(successPayload);

    } catch(err) {
        console.error('Error submitting suggestion:', err);
        const failPayload = buildModBResponse({
            title: 'İşlem Başarısız',
            textLines: ['Öneri gönderilirken sistemsel bir hata oluştu.']
        });
        failPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.reply(failPayload).catch(() => {});
    } finally {
        if (conn) conn.release();
    }
}

// -------------------------------------------------------------
// 5. Voting Handler (Matching Exact Screenshot Buttons)
// -------------------------------------------------------------
async function handleSuggestionVote(interaction) {
    const isUp = interaction.customId.startsWith('oneri_vote_up:');
    const suggestionId = parseInt(interaction.customId.split(':')[1], 10);
    const voteType = isUp ? 'up' : 'down';
    const userId = interaction.user.id;

    await interaction.deferUpdate().catch(() => {});

    let conn;
    try {
        conn = await pool.getConnection();
        const existing = await conn.query('SELECT vote_type FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?', [suggestionId, userId]);

        if (existing.length > 0) {
            if (existing[0].vote_type === voteType) {
                // Remove vote (toggle off)
                await conn.query('DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?', [suggestionId, userId]);
            } else {
                // Switch vote
                await conn.query('UPDATE suggestion_votes SET vote_type = ? WHERE suggestion_id = ? AND user_id = ?', [voteType, suggestionId, userId]);
            }
        } else {
            // New vote
            await conn.query('INSERT INTO suggestion_votes (suggestion_id, user_id, vote_type) VALUES (?, ?, ?)', [suggestionId, userId, voteType]);
        }

        // Recalculate
        const countUp = await conn.query("SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND vote_type = 'up'", [suggestionId]);
        const countDown = await conn.query("SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND vote_type = 'down'", [suggestionId]);

        const upvotes = Number(countUp[0]?.cnt || 0);
        const downvotes = Number(countDown[0]?.cnt || 0);

        await conn.query('UPDATE suggestions SET upvotes = ?, downvotes = ? WHERE id = ?', [upvotes, downvotes, suggestionId]);

        const suggRows = await conn.query('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
        if (suggRows.length === 0) return;
        const sugg = suggRows[0];

        const paddedId = String(sugg.id).padStart(4, '0');
        const submitterText = sugg.is_anonymous ? 'Anonim' : `<@${sugg.user_id}>`;
        const timeVal = Math.floor(new Date(sugg.created_at).getTime() / 1000);

        const eVote = getMonoEmoji('vote');
        const eId = getMonoEmoji('id_card');
        const eUser = getMonoEmoji('user');
        const eClock = getMonoEmoji('clock');

        const rowVote = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`oneri_vote_up:${suggestionId}`).setLabel(String(upvotes)).setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.plus),
            new ButtonBuilder().setCustomId(`oneri_vote_down:${suggestionId}`).setLabel(String(downvotes)).setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.minus)
        );

        const updatedPayload = buildModBResponse({
            title: `${eVote} Öneri`,
            textLines: [
                `> ${sugg.content}`,
                '---SEPARATOR---',
                `${eId} **Öneri No:** #${paddedId}\n${eUser} **Gönderen:** ${submitterText}\n${eClock} **Gönderildi:** <t:${timeVal}:R>`
            ],
            actionRows: [rowVote]
        });

        await interaction.editReply(updatedPayload).catch(() => {});

    } catch(err) {
        console.error('Error handling vote:', err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    getSuggestionSetup,
    saveSuggestionSetup,
    renderSuggestionAdminMenu,
    handleSuggestionInteraction
};
