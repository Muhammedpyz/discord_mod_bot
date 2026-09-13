// Fully implemented dynamic V2 Ticket System with pure MONO emojis and native builders
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder,
    MessageFlags, AttachmentBuilder, PermissionFlagsBits
} = require('discord.js');
const { buildModBResponse, createContainerMessage, buildTicketActionComponents, MONO_EMOJIS } = require('./uiBuilder');
const { pool } = require('../db');
const cacheManager = require('./cacheManager');
const discordTranscripts = require('discord-html-transcripts');

const nudgeCooldowns = new Map();

// Helper to get formatted custom mono emoji string
function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

// -------------------------------------------------------------
// Database Operations (with In-Memory FastCache)
// -------------------------------------------------------------
async function getTicketSetup(guildId) {
    const cacheKey = `ticket_setup_${guildId}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM tickets_setup WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            let setup = rows[0];
            try { setup.support_roles = typeof setup.support_roles === 'string' ? JSON.parse(setup.support_roles) : (setup.support_roles || []); } catch(e) { setup.support_roles = []; }
            try { setup.ticket_types = typeof setup.ticket_types === 'string' ? JSON.parse(setup.ticket_types) : (setup.ticket_types || []); } catch(e) { setup.ticket_types = []; }
            try { setup.panel_sections = typeof setup.panel_sections === 'string' ? JSON.parse(setup.panel_sections) : (setup.panel_sections || []); } catch(e) { setup.panel_sections = []; }
            cacheManager.set(cacheKey, setup, 120);
            return setup;
        }
        const defaultSetup = {
            guild_id: guildId,
            room_type: 'channel',
            category_id: null,
            support_roles: [],
            log_channel_id: null,
            ticket_types: [],
            published_panel_id: null,
            panel_channel_id: null,
            thread_channel_id: null,
            archive_category_id: null,
            room_name_template: 'ticket-{number}',
            user_limit: 1,
            create_transcript: 1,
            ping_roles: 0,
            panel_sections: ['how_it_works', 'type_list', 'stats', 'warning'],
            close_behavior: 'archive',
            welcome_message: null
        };
        cacheManager.set(cacheKey, defaultSetup, 120);
        return defaultSetup;
    } catch(err) {
        console.error('getTicketSetup error:', err);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function saveTicketSetup(setup) {
    let conn;
    try {
        cacheManager.del(`ticket_setup_${setup.guild_id}`);
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO tickets_setup 
            (guild_id, room_type, category_id, support_roles, log_channel_id, ticket_types, published_panel_id, panel_channel_id, thread_channel_id, archive_category_id, room_name_template, user_limit, create_transcript, ping_roles, panel_sections, close_behavior, welcome_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            room_type=VALUES(room_type), category_id=VALUES(category_id), support_roles=VALUES(support_roles), log_channel_id=VALUES(log_channel_id), ticket_types=VALUES(ticket_types), published_panel_id=VALUES(published_panel_id), panel_channel_id=VALUES(panel_channel_id), thread_channel_id=VALUES(thread_channel_id), archive_category_id=VALUES(archive_category_id), room_name_template=VALUES(room_name_template), user_limit=VALUES(user_limit), create_transcript=VALUES(create_transcript), ping_roles=VALUES(ping_roles), panel_sections=VALUES(panel_sections), close_behavior=VALUES(close_behavior), welcome_message=VALUES(welcome_message)
        `, [
            setup.guild_id,
            setup.room_type || 'channel',
            setup.category_id || null,
            JSON.stringify(setup.support_roles || []),
            setup.log_channel_id || null,
            JSON.stringify(setup.ticket_types || []),
            setup.published_panel_id || null,
            setup.panel_channel_id || null,
            setup.thread_channel_id || null,
            setup.archive_category_id || null,
            setup.room_name_template || 'ticket-{number}',
            setup.user_limit || 1,
            setup.create_transcript !== undefined ? setup.create_transcript : 1,
            setup.ping_roles ? 1 : 0,
            JSON.stringify(setup.panel_sections || []),
            setup.close_behavior || 'archive',
            setup.welcome_message || null
        ]);
    } catch(err) {
        console.error('saveTicketSetup error:', err);
    } finally {
        if (conn) conn.release();
    }
}

// -------------------------------------------------------------
// Field extraction helpers
// -------------------------------------------------------------
function selectedChannelId(interaction, customId) {
    try {
        const channels = interaction.fields.getSelectedChannels(customId, false);
        return channels?.first()?.id || null;
    } catch(e) {
        return null;
    }
}

function selectedRoleIds(interaction, customId) {
    try {
        const roles = interaction.fields.getSelectedRoles(customId, false);
        return roles ? [...roles.keys()] : [];
    } catch(e) {
        return [];
    }
}

function selectedUserIds(interaction, customId) {
    try {
        const users = interaction.fields.getSelectedUsers(customId, false);
        return users ? [...users.keys()] : [];
    } catch(e) {
        return [];
    }
}

// -------------------------------------------------------------
// 1. Admin Dashboard View
// -------------------------------------------------------------
async function renderTicketAdminMenu(guildId) {
    const setup = await getTicketSetup(guildId);
    
    const eCheck = getMonoEmoji('badge_check');
    const eCircle = getMonoEmoji('circle');

    const roomType = setup?.room_type === 'thread_auto' 
        ? 'Özel alt başlık · yetkilileri ekle' 
        : (setup?.room_type === 'thread_join' ? 'Özel alt başlık · katıl butonu' : 'Özel kanal');

    const categoryText = setup?.category_id ? `<#${setup.category_id}>` : 'kapalı';
    const supportRolesText = setup?.support_roles?.length ? `${setup.support_roles.length} rol` : 'kapalı';
    const logChannelText = setup?.log_channel_id ? `<#${setup.log_channel_id}>` : 'kapalı';
    const typeCount = setup?.ticket_types?.length || 0;
    const typesText = typeCount ? `${typeCount} tanımlı` : 'tek buton';
    const publishedText = setup?.published_panel_id ? (setup.panel_channel_id ? `<#${setup.panel_channel_id}>` : 'açık') : 'kapalı';
    const threadReqText = setup?.room_type?.startsWith('thread') ? (setup?.thread_channel_id ? `<#${setup.thread_channel_id}>` : 'seçilmedi') : 'bu oda türünde gerekmiyor';
    const threadPermText = setup?.room_type?.startsWith('thread') ? 'ayarlı' : 'bu oda türünde gerekmiyor';
    const closeActionText = setup?.close_behavior === 'delete' ? 'Sil' : 'Arşivle';

    const statusLines = [
        `${eCheck} **Oda türü** › ${roomType}`,
        `${setup?.category_id ? eCheck : eCircle} **Kategori** › ${categoryText}`,
        `${setup?.support_roles?.length ? eCheck : eCircle} **Destek rolleri** › ${supportRolesText}`,
        `${setup?.log_channel_id ? eCheck : eCircle} **Log kanalı** › ${logChannelText}`,
        `${typeCount ? eCheck : eCircle} **Talep türleri** › ${typesText}`,
        `${setup?.published_panel_id ? eCheck : eCircle} **Yayındaki panel** › ${publishedText}`,
        `${eCheck} **Yetkili katılım kanalı** › ${threadReqText}`,
        `${eCheck} **Alt başlık izinleri** › ${threadPermText}`,
        `${eCheck} **Panel bölümleri** › Nasıl çalışır?, Talep türleri listesi, İstatistikler, Uyarı metni`,
        `${eCheck} **Kapanışta** › ${closeActionText}`
    ];

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_setup').setLabel('Kurulum').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.settings),
        new ButtonBuilder().setCustomId('ticket_admin_types').setLabel('Türler').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.folder)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_behavior').setLabel('Davranış').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.gavel)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_panel').setLabel('Panel Gönder').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.ticket),
        new ButtonBuilder().setCustomId('ticket_admin_thread').setLabel('Alt Başlık').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.message_circle)
    );
    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_quick').setLabel('Hızlı Kurulum').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw)
    );

    return buildModBResponse({
        title: 'Destek Sistemi',
        textLines: [
            'Destek talebi sistemini buradan kurarsın. Klasik özel kanal veya özel alt başlık akışını seçebilir, mevcut sistemi değiştirmeden kullanmaya devam edebilirsin.',
            '---SEPARATOR---',
            ...statusLines,
            '---SEPARATOR---',
            'Sistem henüz kurulmadıysa en hızlı yol: **Hızlı Kurulum**.'
        ],
        actionRows: [row1, row2, row3, row4]
    });
}

// -------------------------------------------------------------
// 2. Types Sub-Dashboard
// -------------------------------------------------------------
async function renderTicketTypesMenu(guildId) {
    const setup = await getTicketSetup(guildId);
    const types = setup?.ticket_types || [];
    const typeText = types.length
        ? types.map((type, index) => `**${index + 1}. ${type.name || 'Adsız tür'}**\n${type.description || 'Açıklama yok.'}`).join('\n\n')
        : 'Henüz tür yok — panelde tek **Talep Oluştur** butonu görünür.\n\nEn fazla 10 tür tanımlanabilir. Her türe ayrı kategori verebilirsin.';

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_type_add').setLabel('Tür Ekle').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.add),
        new ButtonBuilder().setCustomId('ticket_admin_home').setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left)
    );

    return buildModBResponse({
        title: 'Talep Türleri',
        textLines: [
            'Tür tanımlarsan panelde seçim menüsü çıkar; hiç tür yoksa tek bir "Talep Oluştur" butonu görünür.',
            '---SEPARATOR---',
            typeText
        ],
        actionRows: [row]
    });
}

// -------------------------------------------------------------
// 3. Sub-views & Standard Modals (100% Discord API compliant)
// -------------------------------------------------------------

async function renderTicketSetupView(guildId) {
    const setup = await getTicketSetup(guildId);
    const roomType = setup?.room_type || 'channel';

    const roomTypeOptions = [
        { label: 'Özel kanal', value: 'channel', description: 'Klasik, izinleri ayrı bir metin kanalı açar.', default: roomType === 'channel' },
        { label: 'Özel alt başlık · yetkilileri ekle', value: 'thread_auto', description: 'Alt başlık açar, yetkilileri doğrudan ekler.', default: roomType === 'thread_auto' },
        { label: 'Özel alt başlık · katıl butonu', value: 'thread_join', description: 'Alt başlık açar; yetkililer butonla katılır.', default: roomType === 'thread_join' }
    ];

    const rowRoomType = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_sel_room_type')
            .setPlaceholder('Talep nerede açılsın? (Oda türü)')
            .addOptions(roomTypeOptions)
    );

    const rowCategory = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('ticket_sel_category')
            .setPlaceholder('Talep kategorisi seçin')
            .setChannelTypes(ChannelType.GuildCategory)
    );

    const rowRoles = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('ticket_sel_support_roles')
            .setPlaceholder('Destek rolleri seçin (birden fazla seçilebilir)')
            .setMinValues(0)
            .setMaxValues(10)
    );

    const rowLog = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('ticket_sel_log_channel')
            .setPlaceholder('Log kanalı seçin')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_btn_welcome_msg').setLabel('Karşılama Metni').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.edit || '1530918960764027000'),
        new ButtonBuilder().setCustomId('ticket_admin_home').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530917536806469783')
    );

    const catText = setup.category_id ? `<#${setup.category_id}>` : 'Seçilmedi';
    const logText = setup.log_channel_id ? `<#${setup.log_channel_id}>` : 'Seçilmedi';
    const rolesText = setup.support_roles?.length ? `${setup.support_roles.length} rol seçili` : 'Seçilmedi';

    return buildModBResponse({
        title: 'Destek Kurulumu',
        textLines: [
            'Aşağıdaki menülerden talep odası türünü, kategoriyi, destek rollerini ve log kanalını ayarlayabilirsiniz.',
            '---SEPARATOR---',
            `**Oda Türü:** \`${roomType}\``,
            `**Kategori:** ${catText}`,
            `**Destek Rolleri:** ${rolesText}`,
            `**Log Kanalı:** ${logText}`,
            `**Karşılama Metni:** ${setup.welcome_message ? 'Özel metin ayarlı' : 'Varsayılan'}`
        ],
        actionRows: [rowRoomType, rowCategory, rowRoles, rowLog, rowBtns]
    });
}

async function renderTicketBehaviorView(guildId) {
    const setup = await getTicketSetup(guildId);
    const closeBehavior = setup?.close_behavior || 'archive';

    const closeOptions = [
        { label: 'Arşivle', value: 'archive', description: 'Talep kapatılınca arşiv kategorisine taşınır.', default: closeBehavior === 'archive' },
        { label: 'Sil', value: 'delete', description: 'Talep kapatılınca kanal tamamen silinir.', default: closeBehavior === 'delete' }
    ];

    const rowClose = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_sel_close_behavior')
            .setPlaceholder('Kapanış davranışı seçin')
            .addOptions(closeOptions)
    );

    const rowArchiveCat = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('ticket_sel_archive_category')
            .setPlaceholder('Arşiv kategorisi seçin')
            .setChannelTypes(ChannelType.GuildCategory)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_btn_behavior_settings').setLabel('Oda Adı & Sınır').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.settings || '1530918960764027000'),
        new ButtonBuilder().setCustomId('ticket_btn_toggle_transcript').setLabel(setup.create_transcript ? 'Transkript: Açık' : 'Transkript: Kapalı').setStyle(setup.create_transcript ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_admin_home').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530917536806469783')
    );

    const archText = setup.archive_category_id ? `<#${setup.archive_category_id}>` : 'Seçilmedi';

    return buildModBResponse({
        title: 'Kapanış ve Davranış Ayarları',
        textLines: [
            'Taleplerin kapatılması, arşivlenmesi ve adlandırma kurallarını buradan yapılandırın.',
            '---SEPARATOR---',
            `**Kapanış Davranışı:** \`${closeBehavior === 'delete' ? 'Sil' : 'Arşivle'}\``,
            `**Arşiv Kategorisi:** ${archText}`,
            `**Oda Adı Şablonu:** \`${setup.room_name_template || 'ticket-{number}'}\``,
            `**Kişi Başı Açık Talep Sınırı:** \`${setup.user_limit || 1}\``,
            `**Transkript Kaydı:** \`${setup.create_transcript ? 'Açık' : 'Kapalı'}\``
        ],
        actionRows: [rowClose, rowArchiveCat, rowBtns]
    });
}

async function renderTicketThreadView(guildId) {
    const setup = await getTicketSetup(guildId);

    const rowThread = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('ticket_sel_thread_channel')
            .setPlaceholder('Yetkili katılım kanalı seçin')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_home').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530917536806469783')
    );

    const thText = setup.thread_channel_id ? `<#${setup.thread_channel_id}>` : 'Seçilmedi';

    return buildModBResponse({
        title: 'Alt Başlık Ayarları',
        textLines: [
            'Butonlu alt başlık modunda "Katıl" kartının gönderileceği yetkili kanalını buradan belirleyebilirsiniz.',
            '---SEPARATOR---',
            `**Yetkili Katılım Kanalı:** ${thText}`
        ],
        actionRows: [rowThread, rowBtns]
    });
}

async function renderTicketPublishView(guildId) {
    const setup = await getTicketSetup(guildId);

    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('ticket_sel_publish_channel')
            .setPlaceholder('Panelin yayınlanacağı kanalı seçin')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_btn_publish_text').setLabel('Başlık & Açıklama').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.edit || '1530918960764027000'),
        new ButtonBuilder().setCustomId('ticket_btn_do_publish').setLabel('Paneli Yayınla').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.send || '1530917534885478600').setDisabled(!setup.panel_channel_id),
        new ButtonBuilder().setCustomId('ticket_admin_home').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530917536806469783')
    );

    const pChanText = setup.panel_channel_id ? `<#${setup.panel_channel_id}>` : 'Seçilmedi';

    return buildModBResponse({
        title: 'Talep Panelini Yayınla',
        textLines: [
            'Destek talebi panelinin gönderileceği kanalı seçip yayına alabilirsiniz.',
            '---SEPARATOR---',
            `**Hedef Kanal:** ${pChanText}`,
            `**Panel Başlığı:** ${setup.panel_title || 'Destek Talebi'}`,
            `**Panel Açıklaması:** ${setup.panel_desc || 'Bir sorunun mu var? Aşağıdan talep oluştur, sana özel bir kanal açılsın ve ekibimiz yardımcı olsun.'}`
        ],
        actionRows: [rowChannel, rowBtns]
    });
}

function buildTicketCreateModal(typeLabel = null) {
    const modal = new ModalBuilder()
        .setCustomId(typeLabel ? `ticket_modal_create:${typeLabel}` : 'ticket_modal_create')
        .setTitle('Destek Talebi Oluştur');

    const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Konu')
        .setPlaceholder('Talebinizin konusunu kısaca özetleyin')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const descInput = new TextInputBuilder()
        .setCustomId('ticket_desc')
        .setLabel('Detaylı Açıklama')
        .setPlaceholder('Ne kadar çok bilgi verirseniz o kadar hızlı çözülür...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1500);

    modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descInput)
    );
    return modal;
}

// -------------------------------------------------------------
// 4. Main Interaction Handler (Dynamic In-Place Updates)
// -------------------------------------------------------------
async function handleTicketInteraction(interaction) {
    const customId = interaction.customId;
    const guildId = interaction.guild?.id;

    // --- Admin Navigation & Modals Opening ---
    if (customId === 'ticket_admin_home') {
        const dashboard = await renderTicketAdminMenu(guildId);
        await interaction.update(dashboard);
    }
    else if (customId === 'ticket_admin_types') {
        const typesView = await renderTicketTypesMenu(guildId);
        await interaction.update(typesView);
    }
    else if (customId === 'ticket_admin_type_add') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_type_add').setTitle('Talep Türü Ekle');
        const nameInput = new TextInputBuilder().setCustomId('ticket_type_name').setLabel('Tür Adı').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
        const descInput = new TextInputBuilder().setCustomId('ticket_type_description').setLabel('Kısa Açıklama').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(descInput));
        await interaction.showModal(modal);
    }
    else if (customId === 'ticket_modal_type_add') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        const ticketTypes = Array.isArray(setup.ticket_types) ? setup.ticket_types : [];
        if (ticketTypes.length >= 10) {
            await interaction.editReply(buildModBResponse({ title: 'Talep Türleri', textLines: ['En fazla 10 talep türü tanımlayabilirsin.'] }));
            return;
        }
        ticketTypes.push({
            name: interaction.fields.getTextInputValue('ticket_type_name').trim(),
            description: interaction.fields.getTextInputValue('ticket_type_description')?.trim() || ''
        });
        setup.ticket_types = ticketTypes;
        await saveTicketSetup(setup);
        await interaction.editReply(await renderTicketTypesMenu(guildId));
    }
    else if (customId === 'ticket_admin_setup') {
        await interaction.deferUpdate();
        const view = await renderTicketSetupView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_room_type') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.room_type = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketSetupView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_category') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.category_id = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketSetupView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_support_roles') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.support_roles = interaction.values;
        await saveTicketSetup(setup);
        const view = await renderTicketSetupView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_log_channel') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.log_channel_id = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketSetupView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_btn_welcome_msg') {
        const setup = await getTicketSetup(guildId);
        const modal = new ModalBuilder().setCustomId('ticket_modal_welcome').setTitle('Karşılama Metni');
        const input = new TextInputBuilder()
            .setCustomId('setup_welcome_message')
            .setLabel('Karşılama Metni')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(setup.welcome_message || '')
            .setRequired(false)
            .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }
    else if (customId === 'ticket_modal_welcome') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        setup.welcome_message = interaction.fields.getTextInputValue('setup_welcome_message')?.trim() || null;
        await saveTicketSetup(setup);
        const view = await renderTicketSetupView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_admin_behavior') {
        await interaction.deferUpdate();
        const view = await renderTicketBehaviorView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_close_behavior') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.close_behavior = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketBehaviorView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_archive_category') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.archive_category_id = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketBehaviorView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_btn_toggle_transcript') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.create_transcript = setup.create_transcript ? 0 : 1;
        await saveTicketSetup(setup);
        const view = await renderTicketBehaviorView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_btn_behavior_settings') {
        const setup = await getTicketSetup(guildId);
        const modal = new ModalBuilder().setCustomId('ticket_modal_behavior_settings').setTitle('Oda Adı ve Sınır');
        const nameInput = new TextInputBuilder()
            .setCustomId('behavior_room_name')
            .setLabel('Oda Adı Şablonu ({number}, {user})')
            .setStyle(TextInputStyle.Short)
            .setValue(setup.room_name_template || 'ticket-{number}')
            .setRequired(true)
            .setMaxLength(50);
        const limitInput = new TextInputBuilder()
            .setCustomId('behavior_user_limit')
            .setLabel('Kişi Başı Açık Talep Sınırı (1-10)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(setup.user_limit || 1))
            .setRequired(true)
            .setMaxLength(2);
        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(limitInput)
        );
        await interaction.showModal(modal);
    }
    else if (customId === 'ticket_modal_behavior_settings') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        setup.room_name_template = interaction.fields.getTextInputValue('behavior_room_name')?.trim() || 'ticket-{number}';
        const limit = parseInt(interaction.fields.getTextInputValue('behavior_user_limit'), 10);
        setup.user_limit = (!isNaN(limit) && limit >= 1 && limit <= 10) ? limit : 1;
        await saveTicketSetup(setup);
        const view = await renderTicketBehaviorView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_admin_thread') {
        await interaction.deferUpdate();
        const view = await renderTicketThreadView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_thread_channel') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.thread_channel_id = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketThreadView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_admin_quick') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        try {
            const guild = interaction.guild;
            let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'destek');
            if (!category) {
                category = await guild.channels.create({ name: 'DESTEK', type: ChannelType.GuildCategory });
            }
            let logChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === 'destek-log');
            if (!logChannel) {
                logChannel = await guild.channels.create({
                    name: 'destek-log',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
                });
            }
            const setup = await getTicketSetup(guildId);
            setup.category_id = category.id;
            setup.log_channel_id = logChannel.id;
            await saveTicketSetup(setup);
            await interaction.editReply(await renderTicketAdminMenu(guildId));
        } catch(err) {
            console.error('Quick setup error:', err);
            await interaction.editReply(buildModBResponse({ title: 'Hata', textLines: ['Hızlı kurulum yapılırken bir yetki hatası oluştu.'] }));
        }
    }
    else if (customId === 'ticket_admin_panel') {
        await interaction.deferUpdate();
        const view = await renderTicketPublishView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_sel_publish_channel') {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        setup.panel_channel_id = interaction.values[0];
        await saveTicketSetup(setup);
        const view = await renderTicketPublishView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_btn_publish_text') {
        const setup = await getTicketSetup(guildId);
        const modal = new ModalBuilder().setCustomId('ticket_modal_publish_text').setTitle('Panel Metinleri');
        const titleInput = new TextInputBuilder()
            .setCustomId('publish_title')
            .setLabel('Panel Başlığı')
            .setStyle(TextInputStyle.Short)
            .setValue(setup.panel_title || 'Destek Talebi')
            .setRequired(false)
            .setMaxLength(100);
        const descInput = new TextInputBuilder()
            .setCustomId('publish_desc')
            .setLabel('Panel Açıklaması')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(setup.panel_desc || 'Bir sorunun mu var? Aşağıdan talep oluştur, sana özel bir kanal açılsın ve ekibimiz yardımcı olsun.')
            .setRequired(false)
            .setMaxLength(1500);
        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );
        await interaction.showModal(modal);
    }
    else if (customId === 'ticket_modal_publish_text') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        setup.panel_title = interaction.fields.getTextInputValue('publish_title')?.trim() || 'Destek Talebi';
        setup.panel_desc = interaction.fields.getTextInputValue('publish_desc')?.trim() || 'Bir sorunun mu var? Aşağıdan talep oluştur, sana özel bir kanal açılsın ve ekibimiz yardımcı olsun.';
        await saveTicketSetup(setup);
        const view = await renderTicketPublishView(guildId);
        await interaction.editReply(view);
    }
    else if (customId === 'ticket_btn_do_publish') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        const channelId = setup.panel_channel_id;
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            return await interaction.editReply(buildModBResponse({ title: 'Hata', textLines: ['Hedef panel kanalı bulunamadı. Lütfen önce kanalı seçin.'] }));
        }

        const panelTitle = setup.panel_title || 'Destek Talebi';
        const panelDesc = setup.panel_desc || 'Bir sorunun mu var? Aşağıdan talep oluştur, sana özel bir kanal açılsın ve ekibimiz yardımcı olsun.';

        let conn;
        let totalCount = 0;
        let openCount = 0;
        try {
            conn = await pool.getConnection();
            const resTotal = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ?', [guildId]);
            const resOpen = await conn.query("SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND status = 'open'", [guildId]);
            totalCount = Number(resTotal[0]?.cnt || 0);
            openCount = Number(resOpen[0]?.cnt || 0);
        } catch(e) {} finally {
            if (conn) conn.release();
        }

        const eChevron = getMonoEmoji('chevron_right');
        let textLines = [
            panelDesc,
            '---SEPARATOR---',
            '**Nasıl çalışır?**',
            `${eChevron} Aşağıdan talebini oluştur, konuyu kısaca yaz.`,
            `${eChevron} Sana özel, sadece senin ve ekibin görebildiği bir kanal açılır.`,
            `${eChevron} Konu çözülünce talep kapatılır ve konuşma kaydı sana gönderilir.`,
            '---SEPARATOR---',
            `${totalCount} talep açıldı · ${openCount} tanesi şu an açık`,
            'Gereksiz talep açmak yetkililerin işini yavaşlatır — lütfen tek seferde net yaz.'
        ];

        let actionRows = [];
        const extraInfoBtn = new ButtonBuilder()
            .setCustomId(`ticket_btn_extra_info_${guildId}`)
            .setLabel('Kurallar & SSS')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.info || MONO_EMOJIS.help_circle);

        if (setup.ticket_types && setup.ticket_types.length > 0) {
            const selectOptions = setup.ticket_types.map((type, idx) => ({
                label: type.name,
                value: `type_${idx}`,
                description: type.description ? type.description.substring(0, 50) : undefined,
                emoji: MONO_EMOJIS.ticket
            }));
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_type')
                .setPlaceholder('Talep türü seçin...')
                .addOptions(selectOptions);
            actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
            actionRows.push(new ActionRowBuilder().addComponents(extraInfoBtn));
        } else {
            const btn = new ButtonBuilder()
                .setCustomId('ticket_create_btn')
                .setLabel('Talep Oluştur')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(MONO_EMOJIS.ticket);
            actionRows.push(new ActionRowBuilder().addComponents(btn, extraInfoBtn));
        }

        const panelPayload = buildModBResponse({
            title: panelTitle,
            textLines: textLines,
            actionRows: actionRows
        });

        let sent = null;
        let isUpdated = false;
        if (setup.published_panel_id) {
            try {
                const oldMsg = await channel.messages.fetch(setup.published_panel_id).catch(() => null);
                if (oldMsg) {
                    await oldMsg.edit(panelPayload);
                    sent = oldMsg;
                    isUpdated = true;
                }
            } catch(e) {}
        }

        if (!sent) {
            sent = await channel.send(panelPayload);
            setup.published_panel_id = sent.id;
            await saveTicketSetup(setup);
        }

        const confirmPayload = buildModBResponse({
            title: isUpdated ? 'Panel Güncellendi' : 'Panel Yayınlandı',
            textLines: [`${getMonoEmoji('check')} Destek paneli <#${channel.id}> kanalında başarıyla ${isUpdated ? 'yerinde güncellendi' : 'yayınlandı'}.`]
        });
        await interaction.editReply(confirmPayload).catch(() => {});
    }

    // --- User Ticket Creation Flows ---
    else if (customId === 'ticket_select_type') {
        const val = interaction.values[0];
        const typeIndex = parseInt(val.replace('type_', ''), 10);
        const setup = await getTicketSetup(guildId);
        const typeObj = setup?.ticket_types?.[typeIndex];
        await interaction.showModal(buildTicketCreateModal(typeObj?.name || null));
    }
    else if (customId === 'ticket_create_btn') {
        await interaction.showModal(buildTicketCreateModal());
    }
    else if (customId.startsWith('ticket_modal_create')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const parts = customId.split(':');
        const typeName = parts[1] || null;
        const subject = interaction.fields.getTextInputValue('ticket_subject')?.trim();
        const desc = interaction.fields.getTextInputValue('ticket_desc')?.trim();
        await createTicket(interaction, subject, desc, typeName);
    }

    // --- In-Room Controls & Dynamic Updates ---
    else if (customId.startsWith('ticket_room_actions_')) {
        const channelId = customId.replace('ticket_room_actions_', '') || interaction.channel.id;
        const selected = interaction.values?.[0];

        if (selected === 'priority') {
            await handleTicketPriorityMenu(interaction);
        } else if (selected === 'adduser') {
            const select = new UserSelectMenuBuilder()
                .setCustomId(`ticket_sel_adduser:${channelId}`)
                .setPlaceholder('Talebe eklenecek kullanıcıyı seçin...')
                .setMinValues(1)
                .setMaxValues(1);
            const row = new ActionRowBuilder().addComponents(select);
            const payload = buildModBResponse({
                title: 'Kişi Ekle',
                textLines: ['Talebe eklemek istediğiniz kullanıcıyı aşağıdaki menüden seçin:'],
                actionRows: [row]
            });
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        } else if (selected === 'removeuser') {
            const select = new UserSelectMenuBuilder()
                .setCustomId(`ticket_sel_removeuser:${channelId}`)
                .setPlaceholder('Talepten çıkarılacak kullanıcıyı seçin...')
                .setMinValues(1)
                .setMaxValues(1);
            const row = new ActionRowBuilder().addComponents(select);
            const payload = buildModBResponse({
                title: 'Kişi Çıkar',
                textLines: ['Talepten çıkarmak istediğiniz kullanıcıyı aşağıdaki menüden seçin:'],
                actionRows: [row]
            });
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        } else if (selected === 'rename') {
            const modal = new ModalBuilder().setCustomId(`ticket_modal_rename:${channelId}`).setTitle('Yeniden Adlandır');
            const input = new TextInputBuilder()
                .setCustomId('new_name')
                .setLabel('Yeni Oda Adı')
                .setStyle(TextInputStyle.Short)
                .setValue(interaction.channel.name)
                .setRequired(true)
                .setMaxLength(50);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (selected === 'nudge') {
            await handleTicketNudge(interaction);
        } else if (selected === 'transcript') {
            await handleTicketTranscript(interaction);
        }
    }
    else if (customId.startsWith('ticket_claim_')) {
        await handleTicketClaim(interaction);
    }
    else if (customId.startsWith('ticket_priority_')) {
        await handleTicketPriorityMenu(interaction);
    }
    else if (customId.startsWith('ticket_set_priority_')) {
        await handleTicketPrioritySet(interaction);
    }
    else if (customId.startsWith('ticket_lock_')) {
        await handleTicketLock(interaction);
    }
    else if (customId.startsWith('ticket_close_prompt_')) {
        await handleTicketClosePrompt(interaction);
    }
    else if (customId.startsWith('ticket_modal_close:')) {
        const reason = interaction.fields.getTextInputValue('close_reason')?.trim() || 'Sorun çözüldü.';
        await handleTicketCloseConfirm(interaction, reason);
    }
    else if (customId.startsWith('ticket_reopen_')) {
        await handleTicketReopen(interaction);
    }
    else if (customId.startsWith('ticket_delete_perm_')) {
        await handleTicketDeletePermanent(interaction);
    }
    else if (customId.startsWith('ticket_btn_extra_info')) {
        await handleTicketExtraInfo(interaction);
    }
    else if (customId.startsWith('ticket_nudge_')) {
        await handleTicketNudge(interaction);
    }
    else if (customId.startsWith('ticket_adduser_')) {
        const channelId = customId.split('_')[2] || interaction.channel.id;
        const select = new UserSelectMenuBuilder()
            .setCustomId(`ticket_sel_adduser:${channelId}`)
            .setPlaceholder('Talebe eklenecek kullanıcıyı seçin...')
            .setMinValues(1)
            .setMaxValues(1);
        const row = new ActionRowBuilder().addComponents(select);
        const payload = buildModBResponse({
            title: 'Kişi Ekle',
            textLines: ['Talebe eklemek istediğiniz kullanıcıyı aşağıdaki menüden seçin:'],
            actionRows: [row]
        });
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
    else if (customId.startsWith('ticket_sel_adduser:')) {
        const channelId = customId.split(':')[1];
        const channel = interaction.guild.channels.cache.get(channelId);
        const targetId = interaction.values?.[0];
        if (channel && targetId) {
            await channel.permissionOverwrites.edit(targetId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            const payload = buildModBResponse({
                title: 'Kişi Eklendi',
                textLines: [`${getMonoEmoji('check')} <@${targetId}> başarıyla talebe eklendi.`]
            });
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
    else if (customId.startsWith('ticket_removeuser_')) {
        const channelId = customId.split('_')[2] || interaction.channel.id;
        const select = new UserSelectMenuBuilder()
            .setCustomId(`ticket_sel_removeuser:${channelId}`)
            .setPlaceholder('Talepten çıkarılacak kullanıcıyı seçin...')
            .setMinValues(1)
            .setMaxValues(1);
        const row = new ActionRowBuilder().addComponents(select);
        const payload = buildModBResponse({
            title: 'Kişi Çıkar',
            textLines: ['Talepten çıkarmak istediğiniz kullanıcıyı aşağıdaki menüden seçin:'],
            actionRows: [row]
        });
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
    else if (customId.startsWith('ticket_sel_removeuser:')) {
        const channelId = customId.split(':')[1];
        const channel = interaction.guild.channels.cache.get(channelId);
        const targetId = interaction.values?.[0];
        if (channel && targetId) {
            await channel.permissionOverwrites.delete(targetId);
            const payload = buildModBResponse({
                title: 'Kişi Çıkarıldı',
                textLines: [`${getMonoEmoji('check')} <@${targetId}> talepten çıkarıldı.`]
            });
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
    else if (customId.startsWith('ticket_rename_')) {
        const modal = new ModalBuilder().setCustomId(`ticket_modal_rename:${interaction.channel.id}`).setTitle('Yeniden Adlandır');
        const input = new TextInputBuilder()
            .setCustomId('new_name')
            .setLabel('Yeni Oda Adı')
            .setStyle(TextInputStyle.Short)
            .setValue(interaction.channel.name)
            .setRequired(true)
            .setMaxLength(50);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }
    else if (customId.startsWith('ticket_modal_rename:')) {
        const channelId = customId.split(':')[1];
        const channel = interaction.guild.channels.cache.get(channelId);
        const newName = interaction.fields.getTextInputValue('new_name')?.trim();
        if (channel && newName) {
            await channel.setName(newName);
            const payload = buildModBResponse({
                title: 'Oda Adı Güncellendi',
                textLines: [`${getMonoEmoji('check')} Oda adı \`${newName}\` olarak değiştirildi.`]
            });
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
    else if (customId.startsWith('ticket_transcript_')) {
        await handleTicketTranscript(interaction);
    }
}

// -------------------------------------------------------------
// 5. Ticket Creation Logic
// -------------------------------------------------------------
async function createTicket(interaction, subject, desc, typeName = null) {
    const guild = interaction.guild;
    const user = interaction.user;
    const setup = await getTicketSetup(guild.id);

    // Limit check
    let conn;
    let userOpenTickets = 0;
    let ticketNum = 1;
    try {
        conn = await pool.getConnection();
        const resUser = await conn.query("SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND owner_id = ? AND status = 'open'", [guild.id, user.id]);
        userOpenTickets = Number(resUser[0]?.cnt || 0);

        if (userOpenTickets >= (setup.user_limit || 1)) {
            return await interaction.editReply(buildModBResponse({
                title: 'Talep Limiti',
                textLines: [`Aynı anda en fazla **${setup.user_limit || 1}** açık talebiniz olabilir.`]
            }));
        }

        const resTotal = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ?', [guild.id]);
        ticketNum = Number(resTotal[0]?.cnt || 0) + 1;
    } finally {
        if (conn) conn.release();
    }

    const paddedNum = String(ticketNum).padStart(4, '0');
    let channelName = (setup.room_name_template || 'ticket-{number}')
        .replace('{number}', paddedNum)
        .replace('{user}', user.username.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Role overwrites
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] }
    ];

    if (setup.support_roles && Array.isArray(setup.support_roles)) {
        for (const roleId of setup.support_roles) {
            overwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
            });
        }
    }

    let ticketChannel;
    try {
        if (setup.room_type?.startsWith('thread')) {
            const baseChannel = guild.channels.cache.get(setup.panel_channel_id) || interaction.channel;
            ticketChannel = await baseChannel.threads.create({
                name: channelName,
                autoArchiveDuration: 1440,
                type: ChannelType.PrivateThread,
                reason: `Ticket ${paddedNum}`
            });
            await ticketChannel.members.add(user.id);
            if (setup.room_type === 'thread_auto' && setup.support_roles) {
                // Direct add support role members if manageable
            }
        } else {
            ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: setup.category_id || null,
                permissionOverwrites: overwrites,
                reason: `Ticket ${paddedNum}`
            });
        }

        conn = await pool.getConnection();
        await conn.query(
            "INSERT INTO tickets (guild_id, channel_id, owner_id, owner_tag, reason, status, opened_at) VALUES (?, ?, ?, ?, ?, 'open', NOW())",
            [guild.id, ticketChannel.id, user.id, user.tag || user.username, subject]
        );

        if (global.activeTicketChannels) global.activeTicketChannels.add(ticketChannel.id);

        // Render main card in room
        const mainRoomMsg = await renderMainRoomMessage(ticketChannel, user, ticketNum, subject, desc, 'Normal', null, 'Açık', setup.welcome_message, typeName);
        if (mainRoomMsg && mainRoomMsg.id) {
            await conn.query('UPDATE tickets SET message_id = ? WHERE channel_id = ?', [mainRoomMsg.id, ticketChannel.id]).catch(() => {});
        }

        // Ping support roles if enabled
        if (setup.ping_roles && setup.support_roles?.length > 0) {
            const roleMentions = setup.support_roles.map(r => `<@&${r}>`).join(' ');
            await ticketChannel.send({ content: roleMentions }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
        }

        await interaction.editReply(buildModBResponse({
            title: 'Talep Oluşturuldu',
            textLines: [`${getMonoEmoji('check')} Talebiniz başarıyla oluşturuldu: <#${ticketChannel.id}>`]
        }));

    } catch(err) {
        console.error('Ticket creation error:', err);
        await interaction.editReply(buildModBResponse({
            title: 'Hata',
            textLines: ['Talep oluşturulurken bir hata meydana geldi.']
        }));
    } finally {
        if (conn) conn.release();
    }
}

// -------------------------------------------------------------
// 6. Dynamic Main Room Card Renderer
// -------------------------------------------------------------
async function renderMainRoomMessage(channel, user, ticketNum, subject, desc, priority, claimedBy, status, welcomeMessage = null, typeName = null) {
    const paddedNum = String(ticketNum).padStart(4, '0');

    const eUser = getMonoEmoji('user');
    const eFlag = getMonoEmoji('flag_triangle_right');
    const eUsers = getMonoEmoji('users');
    const eCheck = getMonoEmoji('badge_check');
    const eTicket = getMonoEmoji('ticket');

    const welcome = welcomeMessage || 'Talebin alındı. Ekibimiz en kısa sürede yanıt verecek — lütfen sabırlı ol.';
    const typeLine = typeName ? `\n${getMonoEmoji('bookmark')} **Tür ›** ${typeName}` : '';

    const textLines = [
        `**${subject}**`,
        welcome,
        '---SEPARATOR---',
        `${eUser} **Açan ›** <@${user.id}> · az önce\n${eFlag} **Öncelik ›** ${priority}\n${eUsers} **Üstlenen ›** ${claimedBy ? `<@${claimedBy}>` : 'henüz kimse üstlenmedi'}\n${eCheck} **Durum ›** ${status}${typeLine}`,
        '---SEPARATOR---',
        `> ${desc || 'Belirtilmedi'}`,
        '---SEPARATOR---',
        '-# Temel aksiyonlar butonlarda, diğer tüm işlemler menüdedir.'
    ];

    const actionRows = buildTicketActionComponents(channel.id, Boolean(claimedBy), status === 'Kilitli');

    const payload = buildModBResponse({
        title: `Talep #${paddedNum}`,
        textLines: textLines,
        actionRows: actionRows,
        images: [user.displayAvatarURL({ dynamic: true })]
    });

    const msg = await channel.send(payload);
    try {
        await msg.pin();
    } catch(e) {}
    return msg;
}

// -------------------------------------------------------------
// 7. In-Room Actions Handlers (Dynamic Updates in Place)
// -------------------------------------------------------------
async function refreshRoomMessageInPlace(channel, updates = {}) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        if (!rows.length) return;
        const ticket = rows[0];

        const ownerUser = await channel.client.users.fetch(ticket.owner_id).catch(() => ({ id: ticket.owner_id, username: ticket.owner_tag, displayAvatarURL: () => '' }));
        const setup = await getTicketSetup(channel.guild.id);

        const paddedNum = String(ticket.id).padStart(4, '0');
        const status = updates.status || (ticket.status === 'open' ? 'Açık' : (ticket.status === 'locked' ? 'Kilitli' : 'Kapalı'));
        const priority = updates.priority || ticket.priority || 'Normal';
        const claimedBy = updates.claimedBy !== undefined ? updates.claimedBy : ticket.claimed_by;

        const eUser = getMonoEmoji('user');
        const eFlag = getMonoEmoji('flag_triangle_right');
        const eUsers = getMonoEmoji('users');
        const eCheck = getMonoEmoji('badge_check');

        const welcome = setup?.welcome_message || 'Talebin alındı. Ekibimiz en kısa sürede yanıt verecek — lütfen sabırlı ol.';

        let actionRows;
        let textLines;

        if (status === 'Kapalı' || status === 'closed') {
            const reopenRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_reopen_${channel.id}`)
                    .setLabel('Talebi Tekrar Aç')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(MONO_EMOJIS.rotate_cw || '1548248467472781432'),
                new ButtonBuilder()
                    .setCustomId(`ticket_delete_perm_${channel.id}`)
                    .setLabel('Kalıcı Olarak Sil')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(MONO_EMOJIS.trash || '1542629920197312532')
            );
            actionRows = [reopenRow];
            textLines = [
                `**${ticket.reason || 'Destek Talebi'}**`,
                '---SEPARATOR---',
                `${eUser} **Açan ›** <@${ticket.owner_id}>\n${eCheck} **Durum ›** Kapalı / Arşivlendi\n${eFlag} **Kapatan ›** ${updates.closedBy ? `<@${updates.closedBy}>` : (ticket.closed_by ? `<@${ticket.closed_by}>` : 'Yetkili')}`,
                `**Kapanış Sebebi ›** ${updates.closeReason || ticket.close_reason || 'Belirtilmedi'}`,
                '---SEPARATOR---',
                '-# Yetkililer veya talep sahibi gerektiğinde bu talebi tekrar açabilir veya kalıcı olarak silebilir.'
            ];
        } else {
            actionRows = buildTicketActionComponents(channel.id, Boolean(claimedBy), status === 'Kilitli');
            textLines = [
                `**${ticket.reason || 'Destek Talebi'}**`,
                welcome,
                '---SEPARATOR---',
                `${eUser} **Açan ›** <@${ticket.owner_id}>\n${eFlag} **Öncelik ›** ${priority}\n${eUsers} **Üstlenen ›** ${claimedBy ? `<@${claimedBy}>` : 'henüz kimse üstlenmedi'}\n${eCheck} **Durum ›** ${status}`,
                '---SEPARATOR---',
                `> ${ticket.reason || 'Belirtilmedi'}`,
                '---SEPARATOR---',
                '-# Temel aksiyonlar butonlarda, diğer tüm işlemler menüdedir.'
            ];
        }

        const payload = buildModBResponse({
            title: `Talep #${paddedNum}`,
            textLines: textLines,
            actionRows: actionRows,
            images: [ownerUser.displayAvatarURL({ dynamic: true })]
        });

        // Find main message to edit in-place
        let mainMsg = null;
        if (ticket.message_id) {
            mainMsg = await channel.messages.fetch(ticket.message_id).catch(() => null);
        }

        if (!mainMsg) {
            try {
                const pinned = await channel.messages.fetchPins().catch(() => null);
                if (pinned) {
                    if (Array.isArray(pinned)) mainMsg = pinned[0];
                    else if (typeof pinned.first === 'function') mainMsg = pinned.first();
                    else if (pinned.values) mainMsg = pinned.values().next().value;
                }
            } catch(e) {}
        }

        if (!mainMsg) {
            try {
                const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
                if (recent && typeof recent.find === 'function') {
                    mainMsg = recent.find(m => m.author.id === channel.client.user.id && m.components && m.components.length > 0);
                }
            } catch(e) {}
        }

        if (mainMsg && typeof mainMsg.edit === 'function') {
            await mainMsg.edit(payload).catch(() => {});
            if (mainMsg.id && ticket.message_id !== mainMsg.id) {
                await conn.query('UPDATE tickets SET message_id = ? WHERE channel_id = ?', [mainMsg.id, channel.id]).catch(() => {});
            }
        }
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketClaim(interaction) {
    const channel = interaction.channel;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT claimed_by FROM tickets WHERE channel_id = ?', [channel.id]);
        const currentClaimed = rows[0]?.claimed_by;

        const newClaimed = currentClaimed === interaction.user.id ? null : interaction.user.id;
        await conn.query('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?', [newClaimed, channel.id]);

        await refreshRoomMessageInPlace(channel, { claimedBy: newClaimed });
        const payload = buildModBResponse({
            title: newClaimed ? 'Talep Üstlenildi' : 'Talep Bırakıldı',
            textLines: [newClaimed ? `${getMonoEmoji('check')} Talep başarıyla üstlenildi.` : `${getMonoEmoji('check')} Talep üzerinizden bırakıldı.`]
        });
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketPriorityMenu(interaction) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`ticket_set_priority_${interaction.channel.id}`)
            .setPlaceholder('Yeni öncelik derecesini seçin...')
            .addOptions([
                { label: 'Düşük', value: 'Düşük', description: 'Acil olmayan genel sorular', emoji: MONO_EMOJIS.flag_triangle_right },
                { label: 'Normal', value: 'Normal', description: 'Standart öncelikli talepler', emoji: MONO_EMOJIS.flag_triangle_right },
                { label: 'Yüksek', value: 'Yüksek', description: 'Önemli ve hızlı yanıt bekleyen konular', emoji: MONO_EMOJIS.warning || MONO_EMOJIS.flag_triangle_right },
                { label: 'Acil', value: 'Acil', description: 'Kritik güvenlik ve acil müdahale gerektiren durumlar', emoji: MONO_EMOJIS.warning || MONO_EMOJIS.flag_triangle_right }
            ])
    );
    const payload = buildModBResponse({
        title: 'Öncelik Seviyesi',
        textLines: ['Lütfen talep için yeni öncelik seviyesini seçin:'],
        actionRows: [row]
    });
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
}

async function handleTicketPrioritySet(interaction) {
    const priority = interaction.values[0];
    const channel = interaction.channel;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE tickets SET priority = ? WHERE channel_id = ?', [priority, channel.id]);
        await refreshRoomMessageInPlace(channel, { priority: priority });
        const payload = buildModBResponse({
            title: 'Öncelik Güncellendi',
            textLines: [`${getMonoEmoji('check')} Öncelik seviyesi **${priority}** olarak güncellendi.`]
        });
        await interaction.update({ ...payload, components: [] });
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketLock(interaction) {
    const channel = interaction.channel;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT status, owner_id FROM tickets WHERE channel_id = ?', [channel.id]);
        const isLocked = rows[0]?.status === 'locked';
        const newStatus = isLocked ? 'open' : 'locked';

        await conn.query('UPDATE tickets SET status = ? WHERE channel_id = ?', [newStatus, channel.id]);

        if (rows[0]?.owner_id) {
            await channel.permissionOverwrites.edit(rows[0].owner_id, {
                SendMessages: isLocked ? true : false
            });
        }

        await refreshRoomMessageInPlace(channel, { status: isLocked ? 'Açık' : 'Kilitli' });
        const payload = buildModBResponse({
            title: isLocked ? 'Kilit Açıldı' : 'Talep Kilitlendi',
            textLines: [isLocked ? `${getMonoEmoji('unlock')} Talep kilidi açıldı.` : `${getMonoEmoji('lock')} Talep kilitlendi, kullanıcı mesaj yazamaz.`]
        });
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketClosePrompt(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_close:${interaction.channel.id}`)
        .setTitle('Destek Talebini Kapat');

    const input = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Kapanış Sebebi')
        .setStyle(TextInputStyle.Paragraph)
        .setValue('Sorun çözüldü / Talep tamamlandı.')
        .setRequired(true)
        .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleTicketNudge(interaction) {
    const channelId = interaction.channel.id;
    const lastNudge = nudgeCooldowns.get(channelId);
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 dakika

    if (lastNudge && Date.now() < lastNudge + COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((lastNudge + COOLDOWN_MS - Date.now()) / 60000);
        const payload = buildModBResponse({
            title: 'Yetkili Dürtme',
            textLines: [`Destek ekibini zaten yakın zamanda dürttünüz. Lütfen sabırla bekleyin (Kalan: **${remainingMinutes} dakika**).`]
        });
        return await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }

    nudgeCooldowns.set(channelId, Date.now());
    const setup = await getTicketSetup(interaction.guild.id);

    const pingText = setup?.support_roles?.length
        ? setup.support_roles.map(r => `<@&${r}>`).join(' ')
        : 'Destek Ekibi';

    await interaction.channel.send({
        content: `${pingText} <:mono:${MONO_EMOJIS.bell_ring}> <@${interaction.user.id}> yetkili ekibinden yanıt bekliyor!`
    });

    const payload = buildModBResponse({
        title: 'Bildirim Gönderildi',
        textLines: [`${getMonoEmoji('check')} Destek ekibine bildirim iletildi.`]
    });
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
}

async function generateTranscripts(channel, closeReason = null) {
    const attachments = [];
    try {
        const htmlAttachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            returnType: 'attachment',
            fileName: `transcript-${channel.name}.html`,
            minify: true,
            saveImages: true,
            useCDN: true
        });
        if (htmlAttachment) attachments.push(htmlAttachment);
    } catch (e) {
        console.error('HTML transcript error:', e);
    }

    try {
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages && messages.size > 0) {
            const sorted = Array.from(messages.values()).reverse();
            let txt = `=====================================================\n`;
            txt += `DESTEK TALEBI KONUSMA GECMISI\n`;
            txt += `Kanal: #${channel.name} | Sunucu: ${channel.guild.name}\n`;
            txt += `Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
            if (closeReason) txt += `Kapanis Sebebi: ${closeReason}\n`;
            txt += `=====================================================\n\n`;
            for (const msg of sorted) {
                const time = new Date(msg.createdTimestamp).toLocaleString('tr-TR');
                const author = msg.author.tag || msg.author.username;
                const content = msg.cleanContent || msg.content || '';
                const files = msg.attachments.size > 0 ? ` [Ekler: ${msg.attachments.map(a => a.url).join(', ')}]` : '';
                txt += `[${time}] ${author}: ${content}${files}\n`;
            }
            const buffer = Buffer.from(txt, 'utf-8');
            attachments.push(new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` }));
        }
    } catch (e) {
        console.error('TXT transcript error:', e);
    }

    return attachments;
}

async function handleTicketTranscript(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const channel = interaction.channel;
        const attachments = await generateTranscripts(channel);

        const payload = buildModBResponse({
            title: 'Talep Transkripti',
            textLines: [`${getMonoEmoji('clipboard_check')} Bu talebin konuşma transkripti (HTML ve TXT) başarıyla oluşturuldu:`]
        });
        await interaction.editReply({ ...payload, files: attachments });
    } catch(err) {
        console.error('Transcript error:', err);
        await interaction.editReply(buildModBResponse({
            title: 'Hata',
            textLines: ['Transkript oluşturulurken bir hata oluştu.']
        }));
    }
}

async function handleTicketCloseConfirm(interaction, closeReason = 'Sorun çözüldü.') {
    const channel = interaction.channel;
    const guild = interaction.guild;
    const setup = await getTicketSetup(guild.id);

    const closeText = setup.close_behavior === 'delete'
        ? `${getMonoEmoji('delete')} Talep kapatıldı (Sebep: *${closeReason}*). Transkript kaydedildi, oda 5 saniye içinde tamamen siliniyor...`
        : `${getMonoEmoji('delete')} Talep kapatıldı (Sebep: *${closeReason}*) ve arşive taşındı.`;

    const closePayload = buildModBResponse({
        title: 'Talep Kapatıldı',
        textLines: [closeText]
    });
    await interaction.reply({ ...closePayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        const ticket = rows[0];

        await conn.query("UPDATE tickets SET status = 'closed', closed_at = NOW(), closed_by = ?, close_reason = ? WHERE channel_id = ?", [interaction.user.id, closeReason, channel.id]);

        // Generate Dual Transcripts (HTML + TXT)
        let attachments = [];
        if (setup.create_transcript !== 0) {
            attachments = await generateTranscripts(channel, closeReason);
        }

        // Send transcript to log channel
        if (setup.log_channel_id && attachments.length > 0) {
            const logChannel = await guild.channels.fetch(setup.log_channel_id).catch(() => null);
            if (logChannel) {
                const logPayload = createContainerMessage(
                    'Talep Kapatıldı',
                    `**Oda:** #${channel.name}\n**Açan:** <@${ticket?.owner_id || 'Bilinmiyor'}>\n**Kapatan:** <@${interaction.user.id}>\n**Talep Konusu:** ${ticket?.reason || 'Belirtilmedi'}\n**Kapanış Sebebi:** ${closeReason}`,
                    '#2B2D31',
                    [],
                    [],
                    false,
                    false,
                    attachments
                );
                await logChannel.send(logPayload).catch(e => console.error('Log channel transcript send error:', e));
            }
        }

        // Send transcript DM to owner
        if (ticket?.owner_id && attachments.length > 0) {
            const owner = await guild.client.users.fetch(ticket.owner_id).catch(() => null);
            if (owner) {
                const dmPayload = createContainerMessage(
                    'Destek Talebiniz Kapatıldı',
                    `**${guild.name}** sunucusundaki destek talebiniz sonlandırıldı.\n\n**Kapanış Sebebi:** ${closeReason}\n\nKonuşma geçmişi (HTML ve TXT) ektedir.`,
                    '#2B2D31',
                    [],
                    [],
                    false,
                    false,
                    attachments
                );
                await owner.send(dmPayload).catch(e => console.error('Owner transcript DM send error:', e));
            }
        }

        // Close behavior: archive or delete
        if (setup.close_behavior === 'archive') {
            if (channel.isThread()) {
                await channel.setLocked(true).catch(() => {});
                await channel.setArchived(true).catch(() => {});
            } else {
                if (setup.archive_category_id) {
                    await channel.setParent(setup.archive_category_id, { lockPermissions: false }).catch(() => {});
                }
                if (ticket?.owner_id) {
                    await channel.permissionOverwrites.edit(ticket.owner_id, { ViewChannel: false, SendMessages: false }).catch(() => {});
                }
                await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false, SendMessages: false }).catch(() => {});
                await channel.setName(`closed-${channel.name.replace('ticket-', '').replace('destek-', '')}`).catch(() => {});
                await refreshRoomMessageInPlace(channel, {
                    status: 'Kapalı',
                    closedBy: interaction.user.id,
                    closeReason: closeReason
                });
            }
        } else {
            // Delete with 5s grace period
            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);
        }

    } catch(err) {
        console.error('Ticket close confirm error:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketReopen(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    const guild = interaction.guild;
    const setup = await getTicketSetup(guild.id);

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        if (!rows.length) {
            return await interaction.editReply(buildModBResponse({
                title: 'Hata',
                textLines: ['Veritabanında bu talebe ait kayıt bulunamadı.']
            }));
        }
        const ticket = rows[0];

        // Yetki Kontrolü: Yalnızca bilet sahibi veya yetkili/destek ekibi açabilir!
        const isOwner = interaction.user.id === ticket.owner_id;
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                        (setup?.support_roles || []).some(rId => interaction.member.roles.cache.has(rId));

        if (!isOwner && !isStaff) {
            return await interaction.editReply(buildModBResponse({
                title: 'Yetki Hatası',
                textLines: ['Bu talebi yalnızca talebi açan kullanıcı veya destek ekibi yeniden açabilir.']
            }));
        }

        // 1. Veritabanını güncelle
        await conn.query("UPDATE tickets SET status = 'open', closed_at = NULL, closed_by = NULL, close_reason = NULL WHERE channel_id = ?", [channel.id]);

        // 2. Aktif kategoriye geri taşı
        if (setup?.category_id) {
            await channel.setParent(setup.category_id, { lockPermissions: false }).catch(() => {});
        }

        // 3. Kullanıcının izinlerini yenile
        if (ticket.owner_id) {
            await channel.permissionOverwrites.edit(ticket.owner_id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            }).catch(() => {});
        }

        // 4. Kanal adını tekrar aç
        const cleanName = channel.name.replace(/^closed-/, '');
        await channel.setName(`ticket-${cleanName}`).catch(() => {});

        await refreshRoomMessageInPlace(channel, { status: 'Açık' });

        await interaction.editReply(buildModBResponse({
            title: 'Başarılı',
            textLines: [`${getMonoEmoji('check')} Talep başarıyla tekrar açıldı ve yetkiler yenilendi.`]
        }));
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketDeletePermanent(interaction) {
    const channel = interaction.channel;
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isStaff) {
        return await interaction.reply({
            ...buildModBResponse({
                title: 'Yetki Hatası',
                textLines: ['Bu talebi kalıcı olarak silmek için **Kanalları Yönet** yetkisine sahip olmalısınız.']
            }),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
        });
    }

    const payload = buildModBResponse({
        title: 'Kalıcı Silme',
        textLines: [`${getMonoEmoji('delete')} Talep <@${interaction.user.id}> tarafından siliniyor. Oda 5 saniye içinde tamamen yok edilecek...`]
    });
    await interaction.reply({ ...payload, flags: MessageFlags.IsComponentsV2 });

    if (global.activeTicketChannels) global.activeTicketChannels.delete(channel.id);

    setTimeout(async () => {
        await channel.delete().catch(() => {});
    }, 5000);
}

async function handleTicketExtraInfo(interaction) {
    const payload = buildModBResponse({
        title: 'Destek Kuralları & Sıkça Sorulanlar (SSS)',
        textLines: [
            `**${getMonoEmoji('shield')} Nyx Destek İlkeleri**`,
            `${getMonoEmoji('chevron_right')} Talebinizde sorununuzu, hata kodlarını veya ekran görüntülerini tek seferde eksiksiz belirtin.`,
            `${getMonoEmoji('chevron_right')} Gereksiz yere yetkilileri etiketlemeyiniz; ekibimiz sırayla tüm talepleri incelemektedir.`,
            `${getMonoEmoji('chevron_right')} Hesap devri, yasa dışı işlemler ve kural ihlali içeren konularda destek sağlanmaz.`,
            '---SEPARATOR---',
            `**${getMonoEmoji('info')} Çalışma & Yanıt Saatleri**`,
            `Destek ekibimiz genellikle **10:00 - 01:00** saatleri arasında aktiftir. Talepler ortalama **15-45 dakika** içerisinde yanıtlanır.`
        ]
    });
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
}

/**
 * Hareketsizlik Zamanlayıcısı (Tam Teşekküllü Inactivity Engine)
 * Açık biletleri 15 dakikada bir tarar; 24 saat işlem yapılmayanlara uyarı bırakır, 36 saati aşanları otomatik kapatır ve transkriptlerini teslim eder.
 */
function startTicketInactivityScheduler(client) {
    setInterval(async () => {
        let conn;
        try {
            conn = await pool.getConnection();
            const openTickets = await conn.query("SELECT * FROM tickets WHERE status = 'open'");
            if (!openTickets || !openTickets.length) return;

            const now = Date.now();
            const WARN_THRESHOLD = 24 * 60 * 60 * 1000; // 24 Saat
            const CLOSE_THRESHOLD = 36 * 60 * 60 * 1000; // 36 Saat

            for (const ticket of openTickets) {
                const channel = client.channels.cache.get(ticket.channel_id);
                if (!channel || channel.deleted) continue;

                try {
                    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
                    if (!messages || !messages.size) continue;

                    const lastMsg = messages.first();
                    const idleTime = now - lastMsg.createdTimestamp;

                    // 36 Saati aşmışsa tam teşekküllü otomatik kapat
                    if (idleTime >= CLOSE_THRESHOLD) {
                        const setup = await getTicketSetup(ticket.guild_id);
                        const autoReason = 'Hareketsizlik zaman aşımı (36 saat boyunca yanıt verilmedi).';

                        await conn.query("UPDATE tickets SET status = 'closed', closed_at = NOW(), close_reason = ? WHERE id = ?", [autoReason, ticket.id]);

                        // 1. Dual Transcripts Oluştur
                        let attachments = [];
                        if (setup?.create_transcript !== 0) {
                            attachments = await generateTranscripts(channel, autoReason).catch(() => []);
                        }

                        // 2. Log Kanalına Gönder
                        if (setup?.log_channel_id && attachments.length > 0) {
                            const logChannel = client.channels.cache.get(setup.log_channel_id);
                            if (logChannel) {
                                const logPayload = createContainerMessage(
                                    'Talep Otomatik Kapatıldı (Zaman Aşımı)',
                                    `**Oda:** #${channel.name}\n**Açan:** <@${ticket.owner_id}>\n**Sebep:** ${autoReason}`,
                                    '#2B2D31',
                                    [],
                                    [],
                                    false,
                                    false,
                                    attachments
                                );
                                await logChannel.send(logPayload).catch(() => {});
                            }
                        }

                        // 3. Kullanıcı DM'ine Gönder
                        if (ticket.owner_id && attachments.length > 0) {
                            const owner = await client.users.fetch(ticket.owner_id).catch(() => null);
                            if (owner) {
                                const dmPayload = createContainerMessage(
                                    'Talebiniz Zaman Aşımı Sebebiyle Kapatıldı',
                                    `**${channel.guild.name}** sunucusundaki destek talebiniz 36 saat boyunca yanıt verilmediği için otomatik kapatıldı.\n\nKonuşma kaydı ektedir.`,
                                    '#2B2D31',
                                    [],
                                    [],
                                    false,
                                    false,
                                    attachments
                                );
                                await owner.send(dmPayload).catch(() => {});
                            }
                        }

                        // 4. Arşivle veya sil
                        if (setup?.close_behavior === 'archive') {
                            if (setup.archive_category_id) {
                                await channel.setParent(setup.archive_category_id, { lockPermissions: false }).catch(() => {});
                            }
                            await channel.permissionOverwrites.edit(ticket.owner_id, {
                                ViewChannel: true,
                                SendMessages: false
                            }).catch(() => {});
                            await channel.setName(`closed-${ticket.id}`).catch(() => {});

                            await refreshRoomMessageInPlace(channel, {
                                status: 'Kapalı',
                                closedBy: client.user.id,
                                closeReason: autoReason
                            });
                        } else {
                            setTimeout(async () => {
                                await channel.delete().catch(() => {});
                            }, 5000);
                        }
                    }
                    // 24 Saati aşmışsa mesaj spamlamamak için yeni mesaj atılmaz
                } catch (innerErr) {
                    console.error(`[Inactivity Ticket Error] Channel ${channel.id}:`, innerErr.message);
                }
            }
        } catch(err) {
            console.error('Ticket inactivity scheduler error:', err.message);
        } finally {
            if (conn) conn.release();
        }
    }, 15 * 60 * 1000);
}

module.exports = {
    getTicketSetup,
    saveTicketSetup,
    renderTicketAdminMenu,
    renderTicketTypesMenu,
    handleTicketInteraction,
    createTicket,
    refreshRoomMessageInPlace,
    startTicketInactivityScheduler
};
