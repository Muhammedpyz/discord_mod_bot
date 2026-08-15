const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const { pool, getGuildSetup, updateGuildSetupCache } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

function mono(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

// 1. Ensure Table Schema & Columns
async function ensurePrivateRoomTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_setup (
                guild_id VARCHAR(255) PRIMARY KEY,
                setup_category_id VARCHAR(255),
                setup_channel_id VARCHAR(255),
                setup_voice_channel_id VARCHAR(255),
                active_rooms_category_id VARCHAR(255),
                log_channel_id VARCHAR(255),
                room_name_template VARCHAR(100) DEFAULT '{user}\\'in Odası',
                user_limit INT DEFAULT 0,
                is_locked BOOLEAN DEFAULT FALSE,
                show_control_card BOOLEAN DEFAULT TRUE,
                transfer_ownership BOOLEAN DEFAULT TRUE,
                blocked_roles_json TEXT
            )
        `);
        try { await conn.query("ALTER TABLE guild_setup ADD COLUMN room_name_template VARCHAR(100) DEFAULT '{user}\\'in Odası'"); } catch(e){}
        try { await conn.query("ALTER TABLE guild_setup ADD COLUMN user_limit INT DEFAULT 0"); } catch(e){}
        try { await conn.query("ALTER TABLE guild_setup ADD COLUMN is_locked BOOLEAN DEFAULT FALSE"); } catch(e){}
        try { await conn.query("ALTER TABLE guild_setup ADD COLUMN show_control_card BOOLEAN DEFAULT TRUE"); } catch(e){}
        try { await conn.query("ALTER TABLE guild_setup ADD COLUMN transfer_ownership BOOLEAN DEFAULT TRUE"); } catch(e){}
        try { await conn.query("ALTER TABLE guild_setup ADD COLUMN blocked_roles_json TEXT"); } catch(e){}
    } catch (err) {
        console.error('[PrivateRoom DB Init Error]:', err.message);
    } finally {
        if (conn) conn.release();
    }
}

ensurePrivateRoomTable().catch(() => {});

// 2. ANA PANEL (Components V2 + SADECE MONO EMOJİLER)
async function renderPrivateRoomMainPanel(guild, setupInfo) {
    let conn;
    let activeRoomsCount = 0;
    try {
        conn = await pool.getConnection();
        const roomRows = await conn.query('SELECT COUNT(*) as cnt FROM active_rooms WHERE guild_id = ?', [guild.id]);
        activeRoomsCount = roomRows.length > 0 ? Number(roomRows[0].cnt) : 0;
    } catch (e) {
    } finally {
        if (conn) conn.release();
    }

    const hasHub = setupInfo && setupInfo.setup_voice_channel_id;
    const hubStr = hasHub ? `<#${setupInfo.setup_voice_channel_id}>` : 'kapalı';

    const catId = setupInfo?.active_rooms_category_id || setupInfo?.setup_category_id;
    const catStr = catId ? `<#${catId}>` : 'hub kanalının kategorisi';

    const nameTemplate = setupInfo?.room_name_template || "{user}'in Odası";
    const userLimit = setupInfo?.user_limit ? `${setupInfo.user_limit} kişi` : 'sınırsız';
    const isLockedDefault = (setupInfo?.is_locked === 1 || setupInfo?.is_locked === true) ? 'kilitli açılır' : 'herkese açık açılır';
    const showCard = (setupInfo?.show_control_card === 0 || setupInfo?.show_control_card === false) ? 'Kapalı' : 'Açık';
    const transferOwner = (setupInfo?.transfer_ownership === 0 || setupInfo?.transfer_ownership === false) ? 'sahip çıkınca kapanır' : 'sahip çıkınca odadakine geçer';

    let blockedRolesStr = 'kapalı';
    if (setupInfo?.blocked_roles_json) {
        try {
            const arr = JSON.parse(setupInfo.blocked_roles_json);
            if (Array.isArray(arr) && arr.length > 0) {
                blockedRolesStr = arr.map(rId => `<@&${rId}>`).join(' ');
            }
        } catch(e){}
    }

    const container = new ContainerBuilder();

    // 1. Header (MONO volume emoji)
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${mono('volume')} Özel Oda Sistemi\nÜye hub kanalına girdiğinde bot ona ait geçici bir ses odası açar ve içine taşır. Oda boşalınca kendiliğinden silinir.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Status Lines (MONO circle / square / hash emojileri)
    const lines = [
        `${mono('circle')} **Hub Kanalı** > ${hubStr}`,
        `${mono('circle')} **Kategori** > ${catStr}`,
        `${mono('square')} **Oda Adı** > \`${nameTemplate}\``,
        `${mono('circle')} **Kişi Sınırı** > ${userLimit}`,
        `${mono('circle')} **Açılış Durumu** > ${isLockedDefault}`,
        `${mono('square')} **Kontrol Kartı** > ${showCard}`,
        `${mono('square')} **Sahiplik Devri** > ${transferOwner}`,
        `${mono('circle')} **Engelli Roller** > ${blockedRolesStr}`,
        `${mono('circle')} **Açık Odalar** > ${activeRoomsCount} oda`
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Footer Notu
    const footerText = hasHub
        ? `-# ${mono('info')} Sistem aktif. Üyeler hub kanalına girdiğinde otomatik geçici odaları açılır.`
        : `Sistem kurulu değil. **Kurulum**'dan bir hub kanalı seç ya da **Hızlı Kurulum**'a bas.`;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footerText)
    );

    // 4. Butonlar (Birebir 3 Satır & Sadece MONO Emojiler)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_kurulum_modal')
            .setLabel('Kurulum')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.settings),
        new ButtonBuilder()
            .setCustomId('privroom_btn_defaults_modal')
            .setLabel('Varsayılanlar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.volume)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_restrictions')
            .setLabel('Kısıtlamalar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.shield)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_list_rooms')
            .setLabel('Odalar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.user)
            .setDisabled(activeRoomsCount === 0),
        new ButtonBuilder()
            .setCustomId('privroom_btn_quick_setup')
            .setLabel('Hızlı Kurulum')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.refresh_cw)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, row1, row2, row3]
    };
}

// 3. KISITLAMALAR GÖRÜNÜMÜ
function renderRestrictionsView(setupInfo) {
    let currentText = 'Henüz engelli rol seçilmedi (kapalı).';

    if (setupInfo?.blocked_roles_json) {
        try {
            const arr = JSON.parse(setupInfo.blocked_roles_json);
            if (Array.isArray(arr) && arr.length > 0) {
                currentText = arr.map(rId => `<@&${rId}>`).join(' ');
            }
        } catch(e){}
    }

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${mono('shield')} Özel Oda Kısıtlamaları\n` +
            `Hub kanalına girse dahi geçici ses odası açamayacak rolleri seçin:\n\n` +
            `» **Engelli Roller:** ${currentText}`
        )
    );

    const selectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('privroom_sel_blocked_roles')
            .setPlaceholder('Oda açamayacak rolleri seçin (Maks 10)')
            .setMinValues(0)
            .setMaxValues(10)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_back')
            .setLabel('Kaydet & Geri Dön')
            .setStyle(ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.check),
        new ButtonBuilder()
            .setCustomId('privroom_btn_clear_restrictions')
            .setLabel('Engelleri Kaldır')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.delete)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, selectRow, btnRow]
    };
}

// 4. KURULUM SEÇİM GÖRÜNÜMÜ
function renderSetupSelectView(setupInfo) {
    const hubStr = setupInfo?.setup_voice_channel_id ? `<#${setupInfo.setup_voice_channel_id}>` : '`Ayarlanmadı (Kapalı)`';
    const catStr = setupInfo?.active_rooms_category_id ? `<#${setupInfo.active_rooms_category_id}>` : '`Hub kanalının kategorisi`';
    const logStr = setupInfo?.log_channel_id ? `<#${setupInfo.log_channel_id}>` : '`Ayarlanmadı`';

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${mono('settings')} Özel Oda Kurulumu\n` +
            `Aşağıdaki menülerden Hub ses kanalını, oda kategorisini ve ses log kanalını tek tek ayarlayabilirsin:\n\n` +
            `» ${mono('volume')} **Hub Kanalı:** ${hubStr}\n` +
            `» ${mono('folder')} **Oda Kategorisi:** ${catStr}\n` +
            `» ${mono('sliders')} **Oda Log Kanalı:** ${logStr}`
        )
    );

    const rowVoice = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('privroom_sel_hub_voice')
            .setPlaceholder('Hub Ses Kanalını Seçin (Katıl-Oluştur kanalı)')
            .addChannelTypes(ChannelType.GuildVoice)
    );

    const rowCat = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('privroom_sel_room_category')
            .setPlaceholder('Odaların Açılacağı Kategoriyi Seçin')
            .addChannelTypes(ChannelType.GuildCategory)
    );

    const rowLog = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('privroom_sel_log_voice')
            .setPlaceholder('Oda Log Kanalını Seçin (İsteğe bağlı)')
            .addChannelTypes(ChannelType.GuildText)
    );

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_back')
            .setLabel('Kaydet & Geri Dön')
            .setStyle(ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.check),
        new ButtonBuilder()
            .setCustomId('privroom_btn_disable_hub')
            .setLabel('Sistemi Kapat')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.delete)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowVoice, rowCat, rowLog, rowBack]
    };
}

// 4.5. HIZLI KURULUM SEÇİM EKRANI
function renderAutoSetupChoiceView() {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${mono('volume')} Hızlı Otomatik Kurulum Modu Seçin\n` +
            `Sunucunuz için en uygun oda açma tarzını seçin. Bot tüm kategorileri, kanalları ve izinleri tek tıkla oluşturur:\n\n` +
            `${mono('zap')} **1. Karma Sistem (Önerilen):** Hem 'Oda Oluştur' ses kanalına girerek hem de metin kanalındaki butona basarak oda açılabilir.\n` +
            `${mono('volume')} **2. Sadece Sesli:** Klasik ses kanalına katılınca anında yeni geçici oda açılır.\n` +
            `${mono('message_square')} **3. Sadece Buton:** Belirlenen kanaldaki butona basıldığında geçici ses odası açılır.`
        )
    );

    const rowChoices = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_exec_auto_karma')
            .setLabel('Karma Sistem')
            .setStyle(ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.zap),
        new ButtonBuilder()
            .setCustomId('privroom_exec_auto_ses')
            .setLabel('Sadece Ses')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.volume),
        new ButtonBuilder()
            .setCustomId('privroom_exec_auto_buton')
            .setLabel('Sadece Buton')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.message_square)
    );

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_back')
            .setLabel('Geri Dön')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.arrow_left)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowChoices, rowBack]
    };
}

// 5. AÇIK ODALAR LİSTESİ GÖRÜNÜMÜ
async function renderActiveRoomsView(guild) {
    let conn;
    let rooms = [];
    try {
        conn = await pool.getConnection();
        rooms = await conn.query('SELECT * FROM active_rooms WHERE guild_id = ? ORDER BY created_at DESC LIMIT 20', [guild.id]);
    } catch(e) {
    } finally {
        if (conn) conn.release();
    }

    const container = new ContainerBuilder();
    let text = `## ${mono('user')} Aktif Özel Odalar (${rooms.length} oda)\n`;

    if (rooms.length === 0) {
        text += 'Şu anda açık herhangi bir özel oda bulunmuyor.';
    } else {
        text += rooms.map((r, i) => `${i + 1}. <#${r.channel_id}> · Sahip: <@${r.owner_id}>`).join('\n');
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text)
    );

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('privroom_btn_back')
            .setLabel('Geri Dön')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.arrow_left)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowBack]
    };
}

// 6. ETKİLEŞİM YÖNETİCİSİ (0ms Hızlı Yanıt & Modal Desteği)
async function handlePrivateRoomAdminInteractions(interaction) {
    const { customId, guildId, guild } = interaction;

    // Modal açacak butonlarda deferUpdate YAPILMAZ!
    if (customId !== 'privroom_btn_defaults_modal') {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (e) {
            return;
        }
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Kurulum Butonu -> Kurulum Menüsü Ekranı
        if (customId === 'privroom_btn_kurulum_modal') {
            const setupInfo = await getGuildSetup(guildId);
            const view = renderSetupSelectView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 2. Varsayılanlar Butonu -> Modal
        if (customId === 'privroom_btn_defaults_modal') {
            const setupInfo = await getGuildSetup(guildId);
            const modal = new ModalBuilder()
                .setCustomId('modal_privroom_defaults')
                .setTitle('Yeni Oda Varsayılanları');

            const nameInput = new TextInputBuilder()
                .setCustomId('input_room_name')
                .setLabel('Oda adı şablonu')
                .setPlaceholder('{user} üyenin adı, {number} oda numarası olur.')
                .setStyle(TextInputStyle.Short)
                .setValue(setupInfo?.room_name_template || "{user}'in Odası")
                .setRequired(false);

            const limitInput = new TextInputBuilder()
                .setCustomId('input_room_limit')
                .setLabel('Kişi sınırı (0-99 arası, 0=sınırsız)')
                .setPlaceholder('0')
                .setStyle(TextInputStyle.Short)
                .setValue(String(setupInfo?.user_limit || 0))
                .setRequired(false);

            const lockInput = new TextInputBuilder()
                .setCustomId('input_room_lock')
                .setLabel('Odalar kilitli açılsın mı? (evet / hayır)')
                .setPlaceholder('hayır')
                .setStyle(TextInputStyle.Short)
                .setValue((setupInfo?.is_locked === 1 || setupInfo?.is_locked === true) ? 'evet' : 'hayır')
                .setRequired(false);

            const cardInput = new TextInputBuilder()
                .setCustomId('input_room_card')
                .setLabel('Odaya kontrol kartı düşsün mü? (evet/hayır)')
                .setPlaceholder('evet')
                .setStyle(TextInputStyle.Short)
                .setValue((setupInfo?.show_control_card === 0 || setupInfo?.show_control_card === false) ? 'hayır' : 'evet')
                .setRequired(false);

            const transferInput = new TextInputBuilder()
                .setCustomId('input_room_transfer')
                .setLabel('Sahip çıkınca sahipliği devret (evet/hayır)')
                .setPlaceholder('evet')
                .setStyle(TextInputStyle.Short)
                .setValue((setupInfo?.transfer_ownership === 0 || setupInfo?.transfer_ownership === false) ? 'hayır' : 'evet')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(limitInput),
                new ActionRowBuilder().addComponents(lockInput),
                new ActionRowBuilder().addComponents(cardInput),
                new ActionRowBuilder().addComponents(transferInput)
            );

            return await interaction.showModal(modal);
        }

        // 3. Kısıtlamalar Butonu
        if (customId === 'privroom_btn_restrictions') {
            const setupInfo = await getGuildSetup(guildId);
            const view = renderRestrictionsView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 4. Odalar Butonu -> Aktif Odalar
        if (customId === 'privroom_btn_list_rooms') {
            const view = await renderActiveRoomsView(guild);
            return await interaction.editReply(view).catch(() => {});
        }

        // 5. Hızlı Kurulum Butonu (3'lü Seçim Menüsü Açılır)
        if (customId === 'privroom_btn_quick_setup') {
            const view = renderAutoSetupChoiceView();
            return await interaction.editReply(view).catch(() => {});
        }

// 5.2. KANALA GÖNDERİLECEK BİLGİLENDİRME KARTI (Karma, Sadece Ses, Sadece Buton Özel)
function buildPublicRoomInfoCard(mode, voiceChanId) {
    const container = new ContainerBuilder();
    let components = [container];

    if (mode === 'karma') {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${mono('settings')} Özel Oda Kurulum Sistemi\n` +
                `### Özel Odanızı Nasıl Oluşturabilirsiniz?\n` +
                `Bu sunucuda **Karma Özel Oda Sistemi** aktiftir. İki farklı yöntemle odanızı saniyeler içinde oluşturabilirsiniz:\n\n` +
                `» ${mono('arrow_right')} **1. Metin ile (Butonlu):** Aşağıdaki **"Oda Oluştur"** butonuna tıklayarak.\n` +
                `» ${mono('arrow_right')} **2. Ses ile (Otomatik):** Doğrudan <#${voiceChanId}> kanalına katılarak.\n\n` +
                `Odanızı oluşturduktan sonra bu sohbete düşecek olan **Kontrol Paneli** üzerinden odanızı kilitleyebilir, gizleyebilir veya yönetebilirsiniz.`
            )
        );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('room_create_voice')
                .setLabel('Oda Oluştur')
                .setStyle(ButtonStyle.Success)
                .setEmoji(MONO_EMOJIS.plus || MONO_EMOJIS.add)
        );
        components.push(row);
    } else if (mode === 'ses') {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${mono('settings')} Özel Oda Kurulum Sistemi\n` +
                `### Özel Odanızı Nasıl Oluşturabilirsiniz?\n` +
                `Bu sunucuda **Otomatik Sesli Özel Oda Sistemi** aktiftir.\n\n` +
                `» ${mono('arrow_right')} **Otomatik Oda Açma:** Doğrudan <#${voiceChanId}> ses kanalına katıldığınızda bot sizin için anında özel bir ses odası açar ve sizi otomatik olarak içine taşır.\n\n` +
                `Odanıza girdikten sonra ses kanalının sohbetine düşecek olan **Kontrol Paneli** üzerinden odanızı kilitleyebilir, isim veya limit belirleyebilirsiniz.\n` +
                `Odada kimse kalmadığında oda otomatik olarak silinir.`
            )
        );
    } else {
        // buton
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${mono('settings')} Özel Oda Kurulum Sistemi\n` +
                `### Özel Odanızı Nasıl Oluşturabilirsiniz?\n` +
                `Bu sunucuda **Butonlu Özel Oda Sistemi** aktiftir.\n\n` +
                `» ${mono('arrow_right')} **Butonla Oda Açma:** Aşağıdaki **"Oda Oluştur"** butonuna tıklayarak kendinize ait geçici ses odasını hemen açabilirsiniz.\n\n` +
                `Odanızı oluşturduktan sonra ses kanalının sohbetine düşecek olan **Kontrol Paneli** üzerinden odanızı kilitleyebilir, isim veya limit belirleyebilirsiniz.\n` +
                `Odada kimse kalmadığında oda otomatik olarak silinir.`
            )
        );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('room_create_voice')
                .setLabel('Oda Oluştur')
                .setStyle(ButtonStyle.Success)
                .setEmoji(MONO_EMOJIS.plus || MONO_EMOJIS.add)
        );
        components.push(row);
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components
    };
}

        // 5.1. 3'lü Otomatik Kurulum İşlemleri
        if (customId === 'privroom_exec_auto_karma' || customId === 'privroom_exec_auto_ses' || customId === 'privroom_exec_auto_buton') {
            const mode = customId === 'privroom_exec_auto_karma' ? 'karma' : (customId === 'privroom_exec_auto_ses' ? 'ses' : 'buton');
            
            // 1. Kategori Oluştur
            let cat = await guild.channels.create({
                name: 'OZEL ODALAR',
                type: ChannelType.GuildCategory
            }).catch(() => null);

            let voiceChan = null;
            let textChan = null;
            let logChan = null;

            if (mode === 'karma' || mode === 'ses') {
                voiceChan = await guild.channels.create({
                    name: 'Oda Oluştur',
                    type: ChannelType.GuildVoice,
                    parent: cat ? cat.id : null
                }).catch(() => null);
            }

            // Metin bilgilendirme / panel kanalı
            const textChanName = mode === 'ses' ? 'oda-bilgi' : 'oda-olustur';
            textChan = await guild.channels.create({
                name: textChanName,
                type: ChannelType.GuildText,
                parent: cat ? cat.id : null,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
                    { id: guild.client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] }
                ]
            }).catch(() => null);

            if (textChan) {
                const infoCard = buildPublicRoomInfoCard(mode, voiceChan ? voiceChan.id : 'ayarlanmadı');
                await textChan.send(infoCard).catch(() => {});
            }

            await conn.query(`
                INSERT INTO guild_setup (guild_id, setup_voice_channel_id, setup_channel_id, active_rooms_category_id, setup_category_id)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    setup_voice_channel_id = VALUES(setup_voice_channel_id),
                    setup_channel_id = VALUES(setup_channel_id),
                    active_rooms_category_id = VALUES(active_rooms_category_id),
                    setup_category_id = VALUES(setup_category_id)
            `, [guildId, voiceChan ? voiceChan.id : null, textChan ? textChan.id : null, cat ? cat.id : null, cat ? cat.id : null]);

            updateGuildSetupCache(guildId, {
                guild_id: guildId,
                setup_voice_channel_id: voiceChan ? voiceChan.id : null,
                setup_channel_id: textChan ? textChan.id : null,
                active_rooms_category_id: cat ? cat.id : null,
                setup_category_id: cat ? cat.id : null
            });

            const setupInfo = await getGuildSetup(guildId);
            const view = await renderPrivateRoomMainPanel(guild, setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 6. Geri Dön / Ana Panele Dön
        if (customId === 'privroom_btn_back') {
            const setupInfo = await getGuildSetup(guildId);
            const view = await renderPrivateRoomMainPanel(guild, setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 7. Select Menu: Hub Ses Kanalı
        if (customId === 'privroom_sel_hub_voice') {
            const voiceId = interaction.values[0];
            await conn.query(`
                INSERT INTO guild_setup (guild_id, setup_voice_channel_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE setup_voice_channel_id = VALUES(setup_voice_channel_id)
            `, [guildId, voiceId]);

            const setupInfo = await getGuildSetup(guildId);
            const view = renderSetupSelectView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 7.1. Select Menu: Oda Log Kanalı
        if (customId === 'privroom_sel_log_voice') {
            const logId = interaction.values[0];
            await conn.query(`
                INSERT INTO guild_setup (guild_id, log_channel_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE log_channel_id = VALUES(log_channel_id)
            `, [guildId, logId]);

            const setupInfo = await getGuildSetup(guildId);
            updateGuildSetupCache(guildId, { ...setupInfo, log_channel_id: logId });
            const view = renderSetupSelectView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 8. Select Menu: Kategori
        if (customId === 'privroom_sel_room_category') {
            const catId = interaction.values[0];
            await conn.query(`
                INSERT INTO guild_setup (guild_id, active_rooms_category_id, setup_category_id)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE active_rooms_category_id = VALUES(active_rooms_category_id), setup_category_id = VALUES(setup_category_id)
            `, [guildId, catId, catId]);

            const setupInfo = await getGuildSetup(guildId);
            const view = renderSetupSelectView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 9. Select Menu: Engelli Roller
        if (customId === 'privroom_sel_blocked_roles') {
            const roles = interaction.values;
            const rolesJson = JSON.stringify(roles);

            await conn.query(`
                INSERT INTO guild_setup (guild_id, blocked_roles_json)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE blocked_roles_json = VALUES(blocked_roles_json)
            `, [guildId, rolesJson]);

            const setupInfo = await getGuildSetup(guildId);
            const view = renderRestrictionsView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 10. Engelleri Kaldır
        if (customId === 'privroom_btn_clear_restrictions') {
            await conn.query(`
                UPDATE guild_setup SET blocked_roles_json = NULL WHERE guild_id = ?
            `, [guildId]);

            const setupInfo = await getGuildSetup(guildId);
            const view = renderRestrictionsView(setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

        // 11. Hub Kapat
        if (customId === 'privroom_btn_disable_hub') {
            await conn.query(`
                UPDATE guild_setup SET setup_voice_channel_id = NULL WHERE guild_id = ?
            `, [guildId]);

            const setupInfo = await getGuildSetup(guildId);
            const view = await renderPrivateRoomMainPanel(guild, setupInfo);
            return await interaction.editReply(view).catch(() => {});
        }

    } catch(err) {
        console.error('handlePrivateRoomAdminInteractions err:', err);
    } finally {
        if (conn) conn.release();
    }
}

// 7. MODAL SUBMIT HANDLER
async function handlePrivateRoomModals(interaction) {
    if (interaction.customId === 'modal_privroom_defaults') {
        try {
            await interaction.deferUpdate();
        } catch (e) {
            return;
        }

        const template = interaction.fields.getTextInputValue('input_room_name') || "{user}'in Odası";
        const limitRaw = interaction.fields.getTextInputValue('input_room_limit') || "0";
        const lockRaw = (interaction.fields.getTextInputValue('input_room_lock') || "hayır").toLowerCase();
        const cardRaw = (interaction.fields.getTextInputValue('input_room_card') || "evet").toLowerCase();
        const transferRaw = (interaction.fields.getTextInputValue('input_room_transfer') || "evet").toLowerCase();

        const limit = Math.max(0, Math.min(99, parseInt(limitRaw) || 0));
        const isLocked = lockRaw.includes('evet') || lockRaw.includes('true') || lockRaw === '1';
        const showCard = !(cardRaw.includes('hayır') || cardRaw.includes('false') || cardRaw === '0');
        const transferOwner = !(transferRaw.includes('hayır') || transferRaw.includes('false') || transferRaw === '0');

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(`
                INSERT INTO guild_setup (guild_id, room_name_template, user_limit, is_locked, show_control_card, transfer_ownership)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    room_name_template = VALUES(room_name_template),
                    user_limit = VALUES(user_limit),
                    is_locked = VALUES(is_locked),
                    show_control_card = VALUES(show_control_card),
                    transfer_ownership = VALUES(transfer_ownership)
            `, [interaction.guildId, template, limit, isLocked, showCard, transferOwner]);

            const setupInfo = await getGuildSetup(interaction.guildId);
            updateGuildSetupCache(interaction.guildId, {
                ...setupInfo,
                room_name_template: template,
                user_limit: limit,
                is_locked: isLocked,
                show_control_card: showCard,
                transfer_ownership: transferOwner
            });

            const view = await renderPrivateRoomMainPanel(interaction.guild, setupInfo);
            await interaction.editReply(view).catch(() => {});
        } catch (err) {
            console.error('modal_privroom_defaults error:', err);
        } finally {
            if (conn) conn.release();
        }
    }
}

module.exports = {
    renderPrivateRoomMainPanel,
    handlePrivateRoomAdminInteractions,
    handlePrivateRoomModals
};
