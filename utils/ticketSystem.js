// Fully implemented dynamic V2 Ticket System with pure MONO emojis and native builders
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder,
    LabelBuilder, RadioGroupBuilder, CheckboxBuilder, CheckboxGroupBuilder,
    MessageFlags, AttachmentBuilder, PermissionFlagsBits
} = require('discord.js');
const { buildModBResponse, createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const { pool } = require('../db');
const discordTranscripts = require('discord-html-transcripts');

const nudgeCooldowns = new Map();

// Helper to get formatted custom mono emoji string
function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

// -------------------------------------------------------------
// Database Operations
// -------------------------------------------------------------
async function getTicketSetup(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM tickets_setup WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            let setup = rows[0];
            try { setup.support_roles = typeof setup.support_roles === 'string' ? JSON.parse(setup.support_roles) : (setup.support_roles || []); } catch(e) { setup.support_roles = []; }
            try { setup.ticket_types = typeof setup.ticket_types === 'string' ? JSON.parse(setup.ticket_types) : (setup.ticket_types || []); } catch(e) { setup.ticket_types = []; }
            try { setup.panel_sections = typeof setup.panel_sections === 'string' ? JSON.parse(setup.panel_sections) : (setup.panel_sections || []); } catch(e) { setup.panel_sections = []; }
            return setup;
        }
        return {
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
// 3. Modals Builders (Using Native Builders & Labels)
// -------------------------------------------------------------
function buildTicketSetupModal(setup) {
    const currentRoomType = setup.room_type || 'channel';
    const modal = new ModalBuilder().setCustomId('ticket_modal_setup').setTitle('Destek Kurulumu');

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Talep nerede açılsın?')
            .setDescription('Mevcut özel kanal veya iki özel alt başlık akışından birini seç.')
            .setRadioGroupComponent(
                new RadioGroupBuilder().setCustomId('setup_room_type').setRequired(true).setOptions([
                    { label: 'Özel kanal', value: 'channel', description: 'Her talep için klasik, izinleri ayrı bir metin kanalı açar.', default: currentRoomType === 'channel' },
                    { label: 'Özel alt başlık · yetkilileri ekle', value: 'thread_auto', description: 'Alt başlığı açar ve destek rolündeki yetkilileri doğrudan ekler.', default: currentRoomType === 'thread_auto' },
                    { label: 'Özel alt başlık · katıl butonu', value: 'thread_join', description: 'Alt başlığı açar; yetkililer ana kanaldaki butonla katılır.', default: currentRoomType === 'thread_join' }
                ])
            ),
        new LabelBuilder()
            .setLabel('Talep kategorisi')
            .setDescription('Klasik kanal modundaki yeni odalar burada açılır. Alt başlık modunda panel kanalı kullanılır.')
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('setup_category').setChannelTypes(ChannelType.GuildCategory).setRequired(false)),
        new LabelBuilder()
            .setLabel('Destek rolleri')
            .setDescription('Bu roller her talebi görebilir ve yönetebilir.')
            .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('setup_support_roles').setMinValues(0).setMaxValues(10).setRequired(false)),
        new LabelBuilder()
            .setLabel('Log kanalı')
            .setDescription('Açılış, üstlenme ve kapanış kayıtları buraya düşer. Transkript de buraya gelir.')
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('setup_log_channel').setChannelTypes(ChannelType.GuildText).setRequired(false)),
        new LabelBuilder()
            .setLabel('Odadaki karşılama metni')
            .setDescription('Talep açılınca odanın içinde görünür. Boş bırakırsan varsayılan kullanılır.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('setup_welcome_message').setStyle(TextInputStyle.Paragraph).setValue(setup.welcome_message || '').setRequired(false).setMaxLength(1000))
    );
    return modal;
}

function buildTicketBehaviorModal(setup) {
    const currentCloseBehavior = setup.close_behavior || 'archive';
    const modal = new ModalBuilder().setCustomId('ticket_modal_behavior').setTitle('Kapanış ve Oda Ayarları');

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Talep kapatılınca ne olsun?')
            .setDescription('Arşivlersen oda kalır, kullanıcı göremez; silersen oda tamamen kaybolur.')
            .setRadioGroupComponent(
                new RadioGroupBuilder().setCustomId('behavior_close_action').setRequired(true).setOptions([
                    { label: 'Arşivle', value: 'archive', default: currentCloseBehavior === 'archive' },
                    { label: 'Sil', value: 'delete', default: currentCloseBehavior === 'delete' }
                ])
            ),
        new LabelBuilder()
            .setLabel('Arşiv kategorisi')
            .setDescription('Klasik kanallar buraya taşınır. Özel alt başlıklar kendi kanalında arşivlenir.')
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('behavior_archive_category').setChannelTypes(ChannelType.GuildCategory).setRequired(false)),
        new LabelBuilder()
            .setLabel('Oda adı şablonu')
            .setDescription('{number} sıra numarası (0001), {user} kullanıcı adı.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('behavior_room_name').setStyle(TextInputStyle.Short).setValue(setup.room_name_template || 'ticket-{number}').setRequired(true).setMaxLength(50)),
        new LabelBuilder()
            .setLabel('Kişi başı açık talep sınırı')
            .setDescription('1 ile 10 arasında. Varsayılan 1.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('behavior_user_limit').setStyle(TextInputStyle.Short).setValue(String(setup.user_limit || 1)).setRequired(true).setMaxLength(2)),
        new LabelBuilder()
            .setLabel('Transkript ayarı')
            .setCheckboxComponent(new CheckboxBuilder().setCustomId('behavior_transcript').setDefault(setup.create_transcript !== 0))
    );
    return modal;
}

function buildTicketThreadModal() {
    const modal = new ModalBuilder().setCustomId('ticket_modal_thread').setTitle('Alt Başlık Ayarları');
    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Yetkili katılım kartı hangi kanala gitsin?')
            .setDescription("Butonlu alt başlık modunda 'Katıl' kartı bu kanala gönderilir.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('thread_channel').setChannelTypes(ChannelType.GuildText).setRequired(true))
    );
    return modal;
}

function buildTicketPublishModal(setup) {
    const modal = new ModalBuilder().setCustomId('ticket_modal_publish').setTitle('Talep Panelini Yayınla');
    const sections = Array.isArray(setup.panel_sections) ? setup.panel_sections : ['how_it_works', 'type_list', 'stats', 'warning'];

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Panel hangi kanala gitsin? *')
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('publish_channel').setChannelTypes(ChannelType.GuildText).setRequired(true)),
        new LabelBuilder()
            .setLabel('Panel başlığı')
            .setTextInputComponent(new TextInputBuilder().setCustomId('publish_title').setStyle(TextInputStyle.Short).setValue('Destek Talebi').setRequired(false).setMaxLength(100)),
        new LabelBuilder()
            .setLabel('Panel açıklaması')
            .setTextInputComponent(new TextInputBuilder().setCustomId('publish_desc').setStyle(TextInputStyle.Paragraph).setValue('Bir sorunun mu var? Aşağıdan talep oluştur, sana özel bir kanal açılsın ve ekibimiz yardımcı olsun.').setRequired(false).setMaxLength(1500)),
        new LabelBuilder()
            .setLabel('Panelde görünecek bölümler')
            .setCheckboxGroupComponent(
                new CheckboxGroupBuilder().setCustomId('publish_sections').setOptions([
                    { label: 'Nasıl çalışır?', value: 'how_it_works', description: 'Üç adımlık kısa anlatım.', default: sections.includes('how_it_works') },
                    { label: 'Talep türleri listesi', value: 'type_list', description: 'Türleri menünün üstünde yazıyla da gösterir.', default: sections.includes('type_list') },
                    { label: 'İstatistikler', value: 'stats', description: 'Açılan talep sayısı ve durum.', default: sections.includes('stats') },
                    { label: 'Uyarı metni', value: 'warning', description: 'Gereksiz talep açma uyarısı.', default: sections.includes('warning') }
                ])
            ),
        new LabelBuilder()
            .setLabel('Talep açılınca destek rollerini etiketle')
            .setCheckboxComponent(new CheckboxBuilder().setCustomId('publish_ping_roles').setDefault(Boolean(setup.ping_roles)))
    );
    return modal;
}

function buildTicketCreateModal(typeLabel = null) {
    const modal = new ModalBuilder().setCustomId(typeLabel ? `ticket_modal_create:${typeLabel}` : 'ticket_modal_create').setTitle('Destek Talebi Oluştur');
    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Konu *')
            .setTextInputComponent(new TextInputBuilder().setCustomId('ticket_subject').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new LabelBuilder()
            .setLabel('Detaylı açıklama')
            .setDescription('Ne kadar çok bilgi verirsen o kadar hızlı çözülür.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('ticket_desc').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1500))
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
        modal.addLabelComponents(
            new LabelBuilder().setLabel('Tür adı *').setTextInputComponent(new TextInputBuilder().setCustomId('ticket_type_name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
            new LabelBuilder().setLabel('Kısa açıklama').setTextInputComponent(new TextInputBuilder().setCustomId('ticket_type_description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300))
        );
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
        const setup = await getTicketSetup(guildId);
        await interaction.showModal(buildTicketSetupModal(setup));
    }
    else if (customId === 'ticket_modal_setup') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        setup.room_type = interaction.fields.getRadioGroup('setup_room_type', true) || 'channel';
        setup.category_id = selectedChannelId(interaction, 'setup_category');
        setup.support_roles = selectedRoleIds(interaction, 'setup_support_roles');
        setup.log_channel_id = selectedChannelId(interaction, 'setup_log_channel');
        setup.welcome_message = interaction.fields.getTextInputValue('setup_welcome_message')?.trim() || null;
        await saveTicketSetup(setup);
        await interaction.editReply(await renderTicketAdminMenu(guildId));
    }
    else if (customId === 'ticket_admin_behavior') {
        const setup = await getTicketSetup(guildId);
        await interaction.showModal(buildTicketBehaviorModal(setup));
    }
    else if (customId === 'ticket_modal_behavior') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        setup.close_behavior = interaction.fields.getRadioGroup('behavior_close_action', true) || 'archive';
        setup.archive_category_id = selectedChannelId(interaction, 'behavior_archive_category');
        setup.room_name_template = interaction.fields.getTextInputValue('behavior_room_name')?.trim() || 'ticket-{number}';
        const limit = parseInt(interaction.fields.getTextInputValue('behavior_user_limit'), 10);
        setup.user_limit = (!isNaN(limit) && limit >= 1 && limit <= 10) ? limit : 1;
        setup.create_transcript = interaction.fields.getCheckbox('behavior_transcript') ? 1 : 0;
        await saveTicketSetup(setup);
        await interaction.editReply(await renderTicketAdminMenu(guildId));
    }
    else if (customId === 'ticket_admin_thread') {
        await interaction.showModal(buildTicketThreadModal());
    }
    else if (customId === 'ticket_modal_thread') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const setup = await getTicketSetup(guildId);
        setup.thread_channel_id = selectedChannelId(interaction, 'thread_channel');
        await saveTicketSetup(setup);
        await interaction.editReply(await renderTicketAdminMenu(guildId));
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
        const setup = await getTicketSetup(guildId);
        await interaction.showModal(buildTicketPublishModal(setup));
    }
    else if (customId === 'ticket_modal_publish') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const channelId = selectedChannelId(interaction, 'publish_channel');
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            return await interaction.editReply(buildModBResponse({ title: 'Hata', textLines: ['Seçilen hedef kanal bulunamadı.'] }));
        }

        const panelTitle = interaction.fields.getTextInputValue('publish_title')?.trim() || 'Destek Talebi';
        const panelDesc = interaction.fields.getTextInputValue('publish_desc')?.trim() || 'Bir sorunun mu var? Aşağıdan talep oluştur, sana özel bir kanal açılsın ve ekibimiz yardımcı olsun.';
        const sections = interaction.fields.getCheckboxGroup('publish_sections') || [];
        const pingRoles = interaction.fields.getCheckbox('publish_ping_roles');

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
        let textLines = [panelDesc];

        if (sections.includes('how_it_works')) {
            textLines.push('---SEPARATOR---');
            textLines.push('**Nasıl çalışır?**');
            textLines.push(`${eChevron} Aşağıdan talebini oluştur, konuyu kısaca yaz.`);
            textLines.push(`${eChevron} Sana özel, sadece senin ve ekibin görebildiği bir kanal açılır.`);
            textLines.push(`${eChevron} Konu çözülünce talep kapatılır ve konuşma kaydı sana gönderilir.`);
        }

        if (sections.includes('stats') || sections.includes('warning')) {
            textLines.push('---SEPARATOR---');
            if (sections.includes('stats')) {
                textLines.push(`${totalCount} talep açıldı · ${openCount} tanesi şu an açık`);
            }
            if (sections.includes('warning')) {
                textLines.push('Gereksiz talep açmak yetkililerin işini yavaşlatır — lütfen tek seferde net yaz.');
            }
        }

        const setup = await getTicketSetup(guildId);
        setup.panel_channel_id = channelId;
        setup.panel_sections = sections;
        setup.ping_roles = pingRoles ? 1 : 0;

        let actionRows = [];
        if (setup.ticket_types && setup.ticket_types.length > 0) {
            const selectOptions = setup.ticket_types.map((type, idx) => ({
                label: type.name,
                value: `type_${idx}`,
                description: type.description ? type.description.substring(0, 50) : undefined
            }));
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_type')
                .setPlaceholder('Talep türü seçin...')
                .addOptions(selectOptions);
            actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
        } else {
            const btn = new ButtonBuilder()
                .setCustomId('ticket_create_btn')
                .setLabel('Talep Oluştur')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(MONO_EMOJIS.ticket);
            actionRows.push(new ActionRowBuilder().addComponents(btn));
        }

        const panelPayload = buildModBResponse({
            title: panelTitle,
            textLines: textLines,
            actionRows: actionRows
        });

        const sent = await channel.send(panelPayload);
        setup.published_panel_id = sent.id;
        await saveTicketSetup(setup);

        await interaction.editReply(await renderTicketAdminMenu(guildId));
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
    else if (customId.startsWith('ticket_nudge_')) {
        await handleTicketNudge(interaction);
    }
    else if (customId.startsWith('ticket_adduser_')) {
        const modal = new ModalBuilder().setCustomId(`ticket_modal_adduser:${interaction.channel.id}`).setTitle('Kişi Ekle');
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel('Eklenecek Kullanıcı')
                .setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('target_user').setRequired(true))
        );
        await interaction.showModal(modal);
    }
    else if (customId.startsWith('ticket_modal_adduser:')) {
        const channelId = customId.split(':')[1];
        const channel = interaction.guild.channels.cache.get(channelId);
        const userIds = selectedUserIds(interaction, 'target_user');
        if (channel && userIds.length > 0) {
            const targetId = userIds[0];
            await channel.permissionOverwrites.edit(targetId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            await interaction.reply({ content: `${getMonoEmoji('check')} <@${targetId}> talebe eklendi.`, flags: MessageFlags.Ephemeral });
        }
    }
    else if (customId.startsWith('ticket_removeuser_')) {
        const modal = new ModalBuilder().setCustomId(`ticket_modal_removeuser:${interaction.channel.id}`).setTitle('Kişi Çıkar');
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel('Çıkarılacak Kullanıcı')
                .setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('target_user').setRequired(true))
        );
        await interaction.showModal(modal);
    }
    else if (customId.startsWith('ticket_modal_removeuser:')) {
        const channelId = customId.split(':')[1];
        const channel = interaction.guild.channels.cache.get(channelId);
        const userIds = selectedUserIds(interaction, 'target_user');
        if (channel && userIds.length > 0) {
            const targetId = userIds[0];
            await channel.permissionOverwrites.delete(targetId);
            await interaction.reply({ content: `${getMonoEmoji('check')} <@${targetId}> talepten çıkarıldı.`, flags: MessageFlags.Ephemeral });
        }
    }
    else if (customId.startsWith('ticket_rename_')) {
        const modal = new ModalBuilder().setCustomId(`ticket_modal_rename:${interaction.channel.id}`).setTitle('Yeniden Adlandır');
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel('Yeni Oda Adı')
                .setTextInputComponent(new TextInputBuilder().setCustomId('new_name').setStyle(TextInputStyle.Short).setValue(interaction.channel.name).setRequired(true).setMaxLength(50))
        );
        await interaction.showModal(modal);
    }
    else if (customId.startsWith('ticket_modal_rename:')) {
        const channelId = customId.split(':')[1];
        const channel = interaction.guild.channels.cache.get(channelId);
        const newName = interaction.fields.getTextInputValue('new_name')?.trim();
        if (channel && newName) {
            await channel.setName(newName);
            await interaction.reply({ content: `${getMonoEmoji('check')} Oda adı \`${newName}\` olarak değiştirildi.`, flags: MessageFlags.Ephemeral });
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
            return await interaction.editReply({ content: `Aynı anda en fazla **${setup.user_limit || 1}** açık talebiniz olabilir.` });
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

        // Render main card in room
        await renderMainRoomMessage(ticketChannel, user, ticketNum, subject, desc, 'Normal', null, 'Açık', setup.welcome_message, typeName);

        // Ping support roles if enabled
        if (setup.ping_roles && setup.support_roles?.length > 0) {
            const roleMentions = setup.support_roles.map(r => `<@&${r}>`).join(' ');
            await ticketChannel.send({ content: roleMentions }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
        }

        await interaction.editReply({ content: `${getMonoEmoji('check')} Talebiniz oluşturuldu: <#${ticketChannel.id}>` });

    } catch(err) {
        console.error('Ticket creation error:', err);
        await interaction.editReply({ content: 'Talep oluşturulurken bir hata meydana geldi.' });
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
    const typeLine = typeName ? `\n🏷️ **Tür ›** ${typeName}` : '';

    const textLines = [
        `**${subject}**`,
        welcome,
        '---SEPARATOR---',
        `${eUser} **Açan ›** <@${user.id}> · az önce\n${eFlag} **Öncelik ›** ${priority}\n${eUsers} **Üstlenen ›** ${claimedBy ? `<@${claimedBy}>` : 'henüz kimse üstlenmedi'}\n${eCheck} **Durum ›** ${status}${typeLine}`,
        '---SEPARATOR---',
        `> ${desc || 'Belirtilmedi'}`,
        '---SEPARATOR---',
        '-# Butonlar yalnızca destek ekibi içindir; talebi açan kişi sadece kapatabilir.'
    ];

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_claim_${channel.id}`).setLabel(claimedBy ? 'Bırak' : 'Üstlen').setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(MONO_EMOJIS.user_round_check),
        new ButtonBuilder().setCustomId(`ticket_priority_${channel.id}`).setLabel('Öncelik').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.flag_triangle_right)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_lock_${channel.id}`).setLabel(status === 'Kilitli' ? 'Kilit Aç' : 'Kilitle').setStyle(ButtonStyle.Secondary).setEmoji(status === 'Kilitli' ? MONO_EMOJIS.unlock : MONO_EMOJIS.lock),
        new ButtonBuilder().setCustomId(`ticket_close_prompt_${channel.id}`).setLabel('Kapat').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_adduser_${channel.id}`).setLabel('Kişi Ekle').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user_round_plus),
        new ButtonBuilder().setCustomId(`ticket_removeuser_${channel.id}`).setLabel('Kişi Çıkar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user_round_minus)
    );
    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_rename_${channel.id}`).setLabel('Yeniden Adlandır').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.file_text),
        new ButtonBuilder().setCustomId(`ticket_nudge_${channel.id}`).setLabel('Yetkiliyi Dürt').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.bell_ring)
    );
    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_transcript_${channel.id}`).setLabel('Transkript').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.clipboard_check)
    );

    const payload = buildModBResponse({
        title: `Talep #${paddedNum}`,
        textLines: textLines,
        actionRows: [row1, row2, row3, row4, row5],
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

        const textLines = [
            `**${ticket.reason || 'Destek Talebi'}**`,
            welcome,
            '---SEPARATOR---',
            `${eUser} **Açan ›** <@${ticket.owner_id}>\n${eFlag} **Öncelik ›** ${priority}\n${eUsers} **Üstlenen ›** ${claimedBy ? `<@${claimedBy}>` : 'henüz kimse üstlenmedi'}\n${eCheck} **Durum ›** ${status}`,
            '---SEPARATOR---',
            `> ${ticket.reason || 'Belirtilmedi'}`,
            '---SEPARATOR---',
            '-# Butonlar yalnızca destek ekibi içindir; talebi açan kişi sadece kapatabilir.'
        ];

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_claim_${channel.id}`).setLabel(claimedBy ? 'Bırak' : 'Üstlen').setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji(MONO_EMOJIS.user_round_check),
            new ButtonBuilder().setCustomId(`ticket_priority_${channel.id}`).setLabel('Öncelik').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.flag_triangle_right)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_lock_${channel.id}`).setLabel(status === 'Kilitli' ? 'Kilit Aç' : 'Kilitle').setStyle(ButtonStyle.Secondary).setEmoji(status === 'Kilitli' ? MONO_EMOJIS.unlock : MONO_EMOJIS.lock),
            new ButtonBuilder().setCustomId(`ticket_close_prompt_${channel.id}`).setLabel('Kapat').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete)
        );
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_adduser_${channel.id}`).setLabel('Kişi Ekle').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user_round_plus),
            new ButtonBuilder().setCustomId(`ticket_removeuser_${channel.id}`).setLabel('Kişi Çıkar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user_round_minus)
        );
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_rename_${channel.id}`).setLabel('Yeniden Adlandır').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.file_text),
            new ButtonBuilder().setCustomId(`ticket_nudge_${channel.id}`).setLabel('Yetkiliyi Dürt').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.bell_ring)
        );
        const row5 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_transcript_${channel.id}`).setLabel('Transkript').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.clipboard_check)
        );

        const payload = buildModBResponse({
            title: `Talep #${paddedNum}`,
            textLines: textLines,
            actionRows: [row1, row2, row3, row4, row5],
            images: [ownerUser.displayAvatarURL({ dynamic: true })]
        });

        // Find pinned message or first bot message to edit in-place
        let mainMsg = null;
        try {
            const pinned = await channel.messages.fetchPins().catch(() => null);
            if (pinned) {
                if (Array.isArray(pinned)) mainMsg = pinned[0];
                else if (typeof pinned.first === 'function') mainMsg = pinned.first();
                else if (pinned.values) mainMsg = pinned.values().next().value;
            }
        } catch(e) {}

        if (!mainMsg) {
            try {
                const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
                if (recent && typeof recent.find === 'function') {
                    mainMsg = recent.find(m => m.author.id === channel.client.user.id);
                }
            } catch(e) {}
        }

        if (mainMsg && typeof mainMsg.edit === 'function') {
            await mainMsg.edit(payload).catch(() => {});
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
        await interaction.reply({
            content: newClaimed ? `${getMonoEmoji('check')} Talep başarıyla üstlenildi.` : `${getMonoEmoji('check')} Talep üzerinizden bırakıldı.`,
            flags: MessageFlags.Ephemeral
        });
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
                { label: 'Düşük', value: 'Düşük', description: 'Acil olmayan genel sorular' },
                { label: 'Normal', value: 'Normal', description: 'Standart öncelikli talepler' },
                { label: 'Yüksek', value: 'Yüksek', description: 'Önemli ve hızlı yanıt bekleyen konular' },
                { label: 'Acil', value: 'Acil', description: 'Kritik güvenlik ve acil müdahale gerektiren durumlar' }
            ])
    );
    await interaction.reply({
        content: 'Lütfen talep için yeni öncelik seviyesini seçin:',
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}

async function handleTicketPrioritySet(interaction) {
    const priority = interaction.values[0];
    const channel = interaction.channel;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE tickets SET priority = ? WHERE channel_id = ?', [priority, channel.id]);
        await refreshRoomMessageInPlace(channel, { priority: priority });
        await interaction.update({ content: `${getMonoEmoji('check')} Öncelik seviyesi **${priority}** olarak güncellendi.`, components: [] });
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
        await interaction.reply({
            content: isLocked ? `${getMonoEmoji('unlock')} Talep kilidi açıldı.` : `${getMonoEmoji('lock')} Talep kilitlendi, kullanıcı mesaj yazamaz.`,
            flags: MessageFlags.Ephemeral
        });
    } finally {
        if (conn) conn.release();
    }
}

async function handleTicketClosePrompt(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_close:${interaction.channel.id}`)
        .setTitle('Destek Talebini Kapat');

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Kapanış Sebebi *')
            .setDescription('Bu sebep log kaydına ve kullanıcıya iletilecek transkripte yazılır.')
            .setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('close_reason')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue('Sorun çözüldü / Talep tamamlandı.')
                    .setRequired(true)
                    .setMaxLength(500)
            )
    );
    await interaction.showModal(modal);
}

async function handleTicketNudge(interaction) {
    const channelId = interaction.channel.id;
    const lastNudge = nudgeCooldowns.get(channelId);
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 dakika

    if (lastNudge && Date.now() < lastNudge + COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((lastNudge + COOLDOWN_MS - Date.now()) / 60000);
        return await interaction.reply({
            content: `⏱️ Destek ekibini zaten yakın zamanda dürttünüz. Lütfen sabırla bekleyin (Kalan: **${remainingMinutes} dakika**).`,
            flags: MessageFlags.Ephemeral
        });
    }

    nudgeCooldowns.set(channelId, Date.now());
    const setup = await getTicketSetup(interaction.guild.id);

    const pingText = setup?.support_roles?.length
        ? setup.support_roles.map(r => `<@&${r}>`).join(' ')
        : 'Destek Ekibi';

    await interaction.channel.send({
        content: `${pingText} 🔔 <@${interaction.user.id}> yetkili ekibinden yanıt bekliyor!`
    });

    await interaction.reply({
        content: `${getMonoEmoji('check')} Destek ekibine bildirim iletildi.`,
        flags: MessageFlags.Ephemeral
    });
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

        await interaction.editReply({
            content: `${getMonoEmoji('clipboard_check')} Bu talebin konuşma transkripti (HTML ve TXT) başarıyla oluşturuldu:`,
            files: attachments
        });
    } catch(err) {
        console.error('Transcript error:', err);
        await interaction.editReply({ content: 'Transkript oluşturulurken bir hata oluştu.' });
    }
}

async function handleTicketCloseConfirm(interaction, closeReason = 'Sorun çözüldü.') {
    const channel = interaction.channel;
    const guild = interaction.guild;
    const setup = await getTicketSetup(guild.id);

    await interaction.reply({
        content: setup.close_behavior === 'delete'
            ? `${getMonoEmoji('delete')} Talep kapatıldı (Sebep: *${closeReason}*). Transkript kaydedildi, oda 5 saniye içinde tamamen siliniyor...`
            : `${getMonoEmoji('delete')} Talep kapatıldı (Sebep: *${closeReason}*) ve arşive taşındı.`,
        flags: MessageFlags.Ephemeral
    });

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
                await refreshRoomMessageInPlace(channel, { status: 'Kapalı' });
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

module.exports = {
    getTicketSetup,
    saveTicketSetup,
    renderTicketAdminMenu,
    renderTicketTypesMenu,
    handleTicketInteraction,
    createTicket
};
