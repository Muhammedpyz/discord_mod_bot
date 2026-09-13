const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');
const { pool, getWelcomeConfig, updateWelcomeConfigCache } = require('../db');
const {
    buildWelcomeMainPanel,
    buildWelcomeSetupView,
    buildGoodbyeSetupView,
    buildWelcomeViewSettings,
    parseWelcomePlaceholders
} = require('./welcomeSystem');
const { generateWelcomeCard } = require('./welcomeCardGenerator');
const { checkSystemNode } = require('./systemNode');
const { MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');
const config = require('../config.json');

/**
 * Handles all button, select menu and modal interactions for the Welcome system
 */
async function handleWelcomeInteraction(interaction, client) {
    const { customId, guildId } = interaction;

    const isSuper = interaction.user.id === config.SUPER_ADMIN_ID || checkSystemNode(interaction.user.id);
    if (!interaction.member?.permissions?.has('ManageGuild') && !isSuper) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Bu paneli sadece sunucu yöneticileri kullanabilir.", flags: MessageFlags.Ephemeral });
        }
        return true;
    }

    // =========================================================================
    // 1. SUB-VIEW GEÇİŞLERİ (NAVIGATION)
    // =========================================================================

    // Karşılama Ayarları Ekranına Geç
    if (customId === 'welcome_btn_setup') {
        await interaction.deferUpdate();
        const view = await buildWelcomeSetupView(guildId);
        return await interaction.editReply(view);
    }

    // Uğurlama Ayarları Ekranına Geç
    if (customId === 'goodbye_btn_setup') {
        await interaction.deferUpdate();
        const view = await buildGoodbyeSetupView(guildId);
        return await interaction.editReply(view);
    }

    // Görünüm & Biçim Ayarları Ekranına Geç
    if (customId === 'welcome_btn_view') {
        await interaction.deferUpdate();
        const view = await buildWelcomeViewSettings(guildId);
        return await interaction.editReply(view);
    }

    // Ana Menüye Dön
    if (customId === 'welcome_btn_home') {
        await interaction.deferUpdate();
        const panel = await buildWelcomeMainPanel(guildId, interaction.guild);
        return await interaction.editReply(panel);
    }

    // =========================================================================
    // 2. KANAL SEÇİCİLER & DEVRE DIŞI BIRAKMA
    // =========================================================================

    // Karşılama Kanalı Seçildi
    if (customId === 'welcome_sel_channel') {
        await interaction.deferUpdate();
        const chanId = interaction.values[0];
        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_channel_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE welcome_channel_id = ?`,
                [guildId, chanId, chanId]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('welcome_sel_channel error:', err);
        }
        const view = await buildWelcomeSetupView(guildId);
        return await interaction.editReply(view);
    }

    // Karşılama Kanalını Kapat
    if (customId === 'welcome_btn_disable_channel') {
        await interaction.deferUpdate();
        try {
            await pool.query('UPDATE welcome_config SET welcome_channel_id = NULL WHERE guild_id = ?', [guildId]);
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('welcome_btn_disable_channel error:', err);
        }
        const view = await buildWelcomeSetupView(guildId);
        return await interaction.editReply(view);
    }

    // Uğurlama Kanalı Seçildi
    if (customId === 'goodbye_sel_channel') {
        await interaction.deferUpdate();
        const chanId = interaction.values[0];
        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, goodbye_channel_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE goodbye_channel_id = ?`,
                [guildId, chanId, chanId]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('goodbye_sel_channel error:', err);
        }
        const view = await buildGoodbyeSetupView(guildId);
        return await interaction.editReply(view);
    }

    // Uğurlama Kanalını Kapat
    if (customId === 'goodbye_btn_disable_channel') {
        await interaction.deferUpdate();
        try {
            await pool.query('UPDATE welcome_config SET goodbye_channel_id = NULL WHERE guild_id = ?', [guildId]);
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('goodbye_btn_disable_channel error:', err);
        }
        const view = await buildGoodbyeSetupView(guildId);
        return await interaction.editReply(view);
    }

    // =========================================================================
    // 3. GÖRÜNÜM AYARLARI (FORMAT SEÇİMİ & BAŞLIK TOGGLE)
    // =========================================================================

    // Karşılama Biçimi Seçildi
    if (customId === 'welcome_sel_format') {
        await interaction.deferUpdate();
        const formatVal = interaction.values[0];
        let genImage = 0;
        let plainText = 0;
        if (formatVal === 'format_image') genImage = 1;
        else if (formatVal === 'format_text') plainText = 1;

        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_gen_image, welcome_plain_text, goodbye_gen_image, goodbye_plain_text)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE welcome_gen_image = ?, welcome_plain_text = ?, goodbye_gen_image = ?, goodbye_plain_text = ?`,
                [guildId, genImage, plainText, genImage, plainText, genImage, plainText, genImage, plainText]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('welcome_sel_format error:', err);
        }
        const view = await buildWelcomeViewSettings(guildId);
        return await interaction.editReply(view);
    }

    // Başlığı Göster / Gizle Toggle
    if (customId === 'welcome_btn_toggle_title') {
        await interaction.deferUpdate();
        try {
            const cfg = await getWelcomeConfig(guildId) || {};
            const currentShow = cfg.welcome_show_title !== false && cfg.welcome_show_title !== 0;
            const newShow = currentShow ? 0 : 1;

            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_show_title, goodbye_show_title)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE welcome_show_title = ?, goodbye_show_title = ?`,
                [guildId, newShow, newShow, newShow, newShow]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('welcome_btn_toggle_title error:', err);
        }
        const view = await buildWelcomeViewSettings(guildId);
        return await interaction.editReply(view);
    }

    // =========================================================================
    // 4. METİN DÜZENLEME MODALLARI (%100 STANDART DISCORD MODALLARI)
    // =========================================================================

    // Karşılama Mesajı Modalını Aç
    if (customId === 'welcome_btn_msg_modal') {
        const cfg = await getWelcomeConfig(guildId) || {};
        const modal = new ModalBuilder()
            .setCustomId('modal_welcome_msg')
            .setTitle('Karşılama Mesajı');

        const input = new TextInputBuilder()
            .setCustomId('welcome_msg_input')
            .setLabel('Karşılama Mesajı')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(cfg.welcome_message || '{user} sunucumuza hoş geldin!')
            .setRequired(true)
            .setMaxLength(1500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // DM Mesajı Modalını Aç
    if (customId === 'welcome_btn_dm_modal') {
        const cfg = await getWelcomeConfig(guildId) || {};
        const modal = new ModalBuilder()
            .setCustomId('modal_welcome_dm')
            .setTitle('DM Karşılama Mesajı');

        const input = new TextInputBuilder()
            .setCustomId('welcome_dm_input')
            .setLabel('Özel DM Mesajı (Boş = Kapalı)')
            .setPlaceholder('Boş bırakırsanız DM karşılama mesajı gönderilmez.')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(cfg.welcome_dm_message || '')
            .setRequired(false)
            .setMaxLength(1500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // Uğurlama Mesajı Modalını Aç
    if (customId === 'goodbye_btn_msg_modal') {
        const cfg = await getWelcomeConfig(guildId) || {};
        const modal = new ModalBuilder()
            .setCustomId('modal_goodbye_msg')
            .setTitle('Uğurlama Mesajı');

        const input = new TextInputBuilder()
            .setCustomId('goodbye_msg_input')
            .setLabel('Uğurlama Mesajı')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(cfg.goodbye_message || '{user} sunucumuzdan ayrıldı.')
            .setRequired(true)
            .setMaxLength(1500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // Başlık Metni Modalını Aç
    if (customId === 'welcome_btn_title_modal') {
        const cfg = await getWelcomeConfig(guildId) || {};
        const modal = new ModalBuilder()
            .setCustomId('modal_welcome_title')
            .setTitle('Kutu Başlık Metni');

        const input = new TextInputBuilder()
            .setCustomId('welcome_title_input')
            .setLabel('Başlık Metni (Boş = Varsayılan)')
            .setPlaceholder('Örn: Hoş Geldin, {user}!')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.welcome_title || '')
            .setRequired(false)
            .setMaxLength(255);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // =========================================================================
    // 5. MODAL SUBMIT HANDLERS
    // =========================================================================

    // Karşılama Mesajı Kaydet
    if (customId === 'modal_welcome_msg') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const newMsg = interaction.fields.getTextInputValue('welcome_msg_input')?.trim() || '{user} sunucumuza hoş geldin!';
        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_message)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE welcome_message = ?`,
                [guildId, newMsg, newMsg]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('modal_welcome_msg save error:', err);
        }

        const payload = createContainerMessage(
            'Karşılama Mesajı Kaydedildi',
            `Yeni karşılama mesajı başarıyla güncellendi:\n\n> ${newMsg}`,
            '#000000'
        );
        return await interaction.editReply(payload);
    }

    // DM Mesajı Kaydet
    if (customId === 'modal_welcome_dm') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const dmVal = interaction.fields.getTextInputValue('welcome_dm_input')?.trim() || null;
        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_dm_message)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE welcome_dm_message = ?`,
                [guildId, dmVal, dmVal]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('modal_welcome_dm save error:', err);
        }

        const payload = createContainerMessage(
            'DM Mesajı Güncellendi',
            dmVal ? `Yeni özel DM karşılama mesajı kaydedildi:\n\n> ${dmVal}` : 'Özel DM karşılama mesajı **kapatıldı**.',
            '#000000'
        );
        return await interaction.editReply(payload);
    }

    // Uğurlama Mesajı Kaydet
    if (customId === 'modal_goodbye_msg') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const newMsg = interaction.fields.getTextInputValue('goodbye_msg_input')?.trim() || '{user} sunucumuzdan ayrıldı.';
        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, goodbye_message)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE goodbye_message = ?`,
                [guildId, newMsg, newMsg]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('modal_goodbye_msg save error:', err);
        }

        const payload = createContainerMessage(
            'Uğurlama Mesajı Kaydedildi',
            `Yeni uğurlama mesajı başarıyla güncellendi:\n\n> ${newMsg}`,
            '#000000'
        );
        return await interaction.editReply(payload);
    }

    // Başlık Metni Kaydet
    if (customId === 'modal_welcome_title') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const titleVal = interaction.fields.getTextInputValue('welcome_title_input')?.trim() || null;
        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_title)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE welcome_title = ?`,
                [guildId, titleVal, titleVal]
            );
            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('modal_welcome_title save error:', err);
        }

        const payload = createContainerMessage(
            'Başlık Metni Güncellendi',
            titleVal ? `Yeni kutu başlığı kaydedildi:\n\n> **${titleVal}**` : 'Kutu başlığı varsayılana döndürüldü.',
            '#000000'
        );
        return await interaction.editReply(payload);
    }

    // =========================================================================
    // 6. TEST ET BUTONU (TEST MESSAGE DISPATCH)
    // =========================================================================
    if (customId === 'welcome_btn_test') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const cfg = await getWelcomeConfig(guildId) || {};

        if (!cfg.welcome_channel_id) {
            const warnContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Karşılama Kanalı Seçilmedi!\nTest mesajı gönderebilmek için lütfen önce **[Karşılama]** menüsünden bir kanal belirleyin.`)
            );
            return await interaction.editReply({ components: [warnContainer], flags: MessageFlags.IsComponentsV2 });
        }

        const targetChannel = interaction.guild?.channels?.cache?.get(cfg.welcome_channel_id);
        if (!targetChannel) {
            const warnContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Kanal Bulunamadı!\nAyarlanan karşılama kanalı sunucuda bulunamadı veya silinmiş. Lütfen **[Karşılama]** menüsünden tekrar kanal seçin.`)
            );
            return await interaction.editReply({ components: [warnContainer], flags: MessageFlags.IsComponentsV2 });
        }

        const testInviter = { id: interaction.guild.ownerId || interaction.user.id, username: 'Kurucu', tag: 'Kurucu#0001' };
        const testInviteCount = 14;
        const testInviteCode = interaction.guild.vanityURLCode || 'nyx';
        const testInviteDuration = 'Süresiz (Kalıcı)';
        const testInviteMaxUses = 'Sınırsız';

        const formattedMsg = parseWelcomePlaceholders(cfg.welcome_message || '{user} sunucumuza hoş geldin!', interaction.member, testInviter, testInviteCount, testInviteCode, testInviteDuration, testInviteMaxUses);

        let files = [];
        let fetchedUser = interaction.user;
        try {
            fetchedUser = await client.users.fetch(interaction.user.id, { force: true });
        } catch (e) {
            fetchedUser = interaction.user;
        }

        const avatarUrl = fetchedUser.displayAvatarURL({ extension: 'png', size: 256 });
        const userFlags = fetchedUser.flags?.toArray() || [];
        const isBooster = !!interaction.member?.premiumSince || interaction.member?.roles?.cache?.some(r => r.name.toLowerCase().includes('boost'));
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const isBot = fetchedUser.bot;

        const customCardHeader = cfg.welcome_title 
            ? parseWelcomePlaceholders(cfg.welcome_title, interaction.member, testInviter, testInviteCount, testInviteCode, testInviteDuration, testInviteMaxUses, true)
            : null;
        const customCardSubtitle = cfg.welcome_message
            ? parseWelcomePlaceholders(cfg.welcome_message, interaction.member, testInviter, testInviteCount, testInviteCode, testInviteDuration, testInviteMaxUses, true)
            : `${interaction.guild.name} sunucusuna katıldın`;

        const hasCountVariable = (cfg.welcome_message && (cfg.welcome_message.includes('{count') || cfg.welcome_message.includes('{memberCount}'))) ||
                                 (cfg.welcome_title && (cfg.welcome_title.includes('{count') || cfg.welcome_title.includes('{memberCount}')));

        if (cfg.welcome_gen_image) {
            const cardBuffer = await generateWelcomeCard({
                avatarUrl,
                username: fetchedUser.tag || fetchedUser.username,
                customHeader: customCardHeader,
                customSubtitle: customCardSubtitle,
                guildName: interaction.guild.name,
                memberCount: interaction.guild.memberCount,
                type: 'welcome',
                userFlags,
                isBooster,
                isOwner,
                isBot,
                showCountPill: !!hasCountVariable
            });
            if (cardBuffer) {
                files.push(new AttachmentBuilder(cardBuffer, { name: 'welcome-card.png' }));
            }
        }

        // 1. Hedef Kanala Gönder (Düz Metin veya V2 Kutulu)
        let channelSentOk = false;
        try {
            if (cfg.welcome_plain_text) {
                await targetChannel.send({
                    content: formattedMsg,
                    files
                });
            } else {
                const channelContainer = new ContainerBuilder();
                if (cfg.welcome_show_title !== false && cfg.welcome_show_title !== 0) {
                    const headerTitle = cfg.welcome_title 
                        ? parseWelcomePlaceholders(cfg.welcome_title, interaction.member)
                        : `Hoş Geldin, ${interaction.user.username}!`;
                    channelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.sparkles || '1537767885978607716'}> ${headerTitle}`));
                }
                channelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(formattedMsg));

                if (files.length > 0) {
                    const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
                    channelContainer.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL('attachment://welcome-card.png')
                        )
                    );
                }

                await targetChannel.send({
                    components: [channelContainer],
                    files,
                    flags: MessageFlags.IsComponentsV2
                });
            }
            channelSentOk = true;
        } catch (sendErr) {
            console.error("Welcome channel send error:", sendErr);
            channelSentOk = false;
        }

        // 2. DM Mesajı Gönder (Ayarlıysa)
        let dmStatusNote = 'Kapalı';
        if (cfg.welcome_dm_message) {
            const dmFormatted = parseWelcomePlaceholders(cfg.welcome_dm_message, interaction.member);
            try {
                await interaction.user.send({ content: dmFormatted });
                dmStatusNote = '`Özelinize Gönderildi`';
            } catch (dmErr) {
                console.error("Test DM send failed:", dmErr);
                dmStatusNote = '`DM Kapalı Olduğu İçin İletilemedi`';
            }
        }

        // 3. Kullanıcıya Canlı Rapor Sun
        const confirmContainer = new ContainerBuilder();
        confirmContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# <:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Test Mesajı Gönderildi!\n\n` +
                `Karşılama test mesajı başarıyla <#${targetChannel.id}> kanalına atıldı.\n\n` +
                `- **Kanal ›** <#${targetChannel.id}>\n` +
                `- **Mesaj Biçimi ›** ${cfg.welcome_plain_text ? '`Düz Metin`' : '`Kutulu V2`'}\n` +
                `- **Görsel Kart ›** ${cfg.welcome_gen_image ? '`Açık (Görsel Eklendi)`' : '`Kapalı`'}\n` +
                `- **Özel DM Mesajı ›** ${dmStatusNote}\n\n` +
                `*Şimdi <#${targetChannel.id}> kanalını kontrol edebilirsin!*`
            )
        );

        return await interaction.editReply({
            components: [confirmContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    return false;
}

module.exports = {
    handleWelcomeInteraction
};
