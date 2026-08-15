const {
    Routes,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    AttachmentBuilder
} = require('discord.js');
const { pool, getWelcomeConfig, updateWelcomeConfigCache } = require('../db');
const { buildWelcomeMainPanel, parseWelcomePlaceholders } = require('./welcomeSystem');
const { generateWelcomeCard } = require('./welcomeCardGenerator');
const { checkSystemNode } = require('./systemNode');
const { MONO_EMOJIS } = require('./uiBuilder');
const config = require('../config.json');

function extractModalValues(interaction) {
    const values = {};
    const rawComponents = (interaction.data && interaction.data.components) || interaction.components || [];
    
    function traverse(comps) {
        if (!comps || !Array.isArray(comps)) return;
        for (const c of comps) {
            if (c.component) traverse([c.component]);
            if (c.components) traverse(c.components);

            const id = c.customId || c.custom_id;
            if (id) {
                if (c.values !== undefined) {
                    values[id] = c.values;
                } else if (c.value !== undefined) {
                    values[id] = c.value;
                }
            }
        }
    }

    traverse(rawComponents);

    if (interaction.fields && interaction.fields.fields) {
        for (const [key, field] of interaction.fields.fields.entries()) {
            if (values[key] === undefined) {
                values[key] = field.value !== undefined ? field.value : field.values;
            }
        }
    }

    return values;
}

async function showRawModal(interaction, client, modalData) {
    return await client.rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
        body: {
            type: 9, // InteractionResponseType.Modal
            data: modalData
        }
    });
}

/**
 * Handles all button and modal interactions for the Welcome system
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

    // 1. Karşılama Ayarları Modalını Aç
    if (customId === 'welcome_btn_setup') {
        const cfg = await getWelcomeConfig(guildId) || {};

        const modalData = {
            title: 'Karşılama Ayarları',
            custom_id: 'modal_welcome_setup',
            components: [
                {
                    type: 18,
                    label: 'Kanal',
                    description: 'Boş bırakırsan bu sistem kapanır.',
                    required: false,
                    component: {
                        type: 8,
                        custom_id: 'welcome_channel',
                        channel_types: [0], // GuildText
                        placeholder: 'Seçim yap',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(cfg.welcome_channel_id ? { default_values: [{ id: cfg.welcome_channel_id, type: 'channel' }] } : {})
                    }
                },
                {
                    type: 18,
                    label: 'Mesaj',
                    description: 'Değişken kullanabilirsin: {user} {server} {count}',
                    required: false,
                    component: {
                        type: 4,
                        custom_id: 'welcome_msg',
                        style: 2,
                        value: cfg.welcome_message || '{user} sunucumuza hoş geldin!',
                        required: false,
                        max_length: 1500
                    }
                },
                {
                    type: 18,
                    label: 'DM mesajı',
                    description: 'Katılan kişiye özelden gönderilir. Boş bırakırsan gönderilmez.',
                    required: false,
                    component: {
                        type: 4,
                        custom_id: 'welcome_dm',
                        style: 2,
                        value: cfg.welcome_dm_message || '',
                        required: false,
                        max_length: 1500
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Welcome setup modal error:", e);
        }
        return true;
    }

    // 2. Uğurlama Ayarları Modalını Aç
    if (customId === 'goodbye_btn_setup') {
        const cfg = await getWelcomeConfig(guildId) || {};

        const modalData = {
            title: 'Uğurlama Ayarları',
            custom_id: 'modal_goodbye_setup',
            components: [
                {
                    type: 18,
                    label: 'Kanal',
                    description: 'Boş bırakırsan bu sistem kapanır.',
                    required: false,
                    component: {
                        type: 8,
                        custom_id: 'goodbye_channel',
                        channel_types: [0], // GuildText
                        placeholder: 'Seçim yap',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(cfg.goodbye_channel_id ? { default_values: [{ id: cfg.goodbye_channel_id, type: 'channel' }] } : {})
                    }
                },
                {
                    type: 18,
                    label: 'Mesaj',
                    description: 'Değişken kullanabilirsin: {user} {server} {count}',
                    required: false,
                    component: {
                        type: 4,
                        custom_id: 'goodbye_msg',
                        style: 2,
                        value: cfg.goodbye_message || '{user} sunucumuzdan ayrıldı.',
                        required: false,
                        max_length: 1500
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Goodbye setup modal error:", e);
        }
        return true;
    }

    // 3. Görünüm Ayarları Modalını Aç
    if (customId === 'welcome_btn_view') {
        const cfg = await getWelcomeConfig(guildId) || {};

        const modalData = {
            title: 'Görünüm Ayarları',
            custom_id: 'modal_welcome_view',
            components: [
                {
                    type: 18,
                    label: 'Karşılama başlığı',
                    description: 'Boş bırakırsan varsayılan kullanılır. Değişken yazabilirsin.',
                    required: false,
                    component: {
                        type: 4,
                        custom_id: 'welcome_title',
                        style: 1,
                        value: cfg.welcome_title || '',
                        required: false,
                        max_length: 255
                    }
                },
                {
                    type: 18,
                    label: 'Karşılama görünümü',
                    required: false,
                    component: {
                        type: 22,
                        custom_id: 'welcome_view_options',
                        min_values: 0,
                        max_values: 3,
                        required: false,
                        options: [
                            {
                                label: 'Başlığı göster',
                                description: 'Kutunun üstündeki kalın satır.',
                                value: 'show_title',
                                default: cfg.welcome_show_title !== false && cfg.welcome_show_title !== 0
                            },
                            {
                                label: 'Görsel kart üret',
                                description: 'Avatarlı karşılama görseli çizilir.',
                                value: 'gen_image',
                                default: !!cfg.welcome_gen_image
                            },
                            {
                                label: 'Düz metin olarak gönder',
                                description: 'Kutu olmadan, normal mesaj gibi gider.',
                                value: 'plain_text',
                                default: !!cfg.welcome_plain_text
                            }
                        ]
                    }
                },
                {
                    type: 18,
                    label: 'Uğurlama başlığı',
                    description: 'Boş bırakırsan varsayılan kullanılır. Değişken yazabilirsin.',
                    required: false,
                    component: {
                        type: 4,
                        custom_id: 'goodbye_title',
                        style: 1,
                        value: cfg.goodbye_title || '',
                        required: false,
                        max_length: 255
                    }
                },
                {
                    type: 18,
                    label: 'Uğurlama görünümü',
                    required: false,
                    component: {
                        type: 22,
                        custom_id: 'goodbye_view_options',
                        min_values: 0,
                        max_values: 3,
                        required: false,
                        options: [
                            {
                                label: 'Başlığı göster',
                                description: 'Kutunun üstündeki kalın satır.',
                                value: 'show_title',
                                default: cfg.goodbye_show_title !== false && cfg.goodbye_show_title !== 0
                            },
                            {
                                label: 'Görsel kart üret',
                                description: 'Avatarlı uğurlama görseli çizilir.',
                                value: 'gen_image',
                                default: !!cfg.goodbye_gen_image
                            },
                            {
                                label: 'Düz metin olarak gönder',
                                description: 'Kutu olmadan, normal mesaj gibi gider.',
                                value: 'plain_text',
                                default: !!cfg.goodbye_plain_text
                            }
                        ]
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("View modal error:", e);
        }
        return true;
    }

    // 4. Test Et Butonu
    if (customId === 'welcome_btn_test') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const cfg = await getWelcomeConfig(guildId) || {};

        if (!cfg.welcome_channel_id) {
            const warnContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Karşılama Kanalı Seçilmedi!\nTest mesajı gönderebilmek için lütfen önce **[Karşılama]** butonundan bir kanal belirleyin.`)
            );
            return await interaction.editReply({ components: [warnContainer], flags: MessageFlags.IsComponentsV2 });
        }

        const targetChannel = interaction.guild?.channels?.cache?.get(cfg.welcome_channel_id);
        if (!targetChannel) {
            const warnContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Kanal Bulunamadı!\nAyarlanan karşılama kanalı sunucuda bulunamadı veya silinmiş. Lütfen **[Karşılama]** butonundan tekrar kanal seçin.`)
            );
            return await interaction.editReply({ components: [warnContainer], flags: MessageFlags.IsComponentsV2 });
        }

        const testInviter = { id: interaction.guild.ownerId || interaction.user.id, username: 'Kurucu', tag: 'Kurucu#0001' };
        const testInviteCount = 14;
        const testInviteCode = interaction.guild.vanityURLCode || 'turklion';
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

    // =========================================================================
    // MODAL SUBMITS
    // =========================================================================

    // 1. Karşılama Ayarları Submit
    if (customId === 'modal_welcome_setup') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const channelArr = values['welcome_channel'];
        const channelId = Array.isArray(channelArr) ? channelArr[0] : (channelArr || null);
        const msg = values['welcome_msg'] || '{user} sunucumuza hoş geldin!';
        const dmMsg = values['welcome_dm'] || null;

        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, welcome_channel_id, welcome_message, welcome_dm_message)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE welcome_channel_id = ?, welcome_message = ?, welcome_dm_message = ?`,
                [guildId, channelId, msg, dmMsg, channelId, msg, dmMsg]
            );

            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('Modal welcome setup error:', err);
        }

        const panel = await buildWelcomeMainPanel(guildId, interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        return await interaction.editReply(panel);
    }

    // 2. Uğurlama Ayarları Submit
    if (customId === 'modal_goodbye_setup') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const channelArr = values['goodbye_channel'];
        const channelId = Array.isArray(channelArr) ? channelArr[0] : (channelArr || null);
        const msg = values['goodbye_msg'] || '{user} sunucumuzdan ayrıldı.';

        try {
            await pool.query(
                `INSERT INTO welcome_config (guild_id, goodbye_channel_id, goodbye_message)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE goodbye_channel_id = ?, goodbye_message = ?`,
                [guildId, channelId, msg, channelId, msg]
            );

            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('Modal goodbye setup error:', err);
        }

        const panel = await buildWelcomeMainPanel(guildId, interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        return await interaction.editReply(panel);
    }

    // 3. Görünüm Ayarları Submit
    if (customId === 'modal_welcome_view') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const welcomeTitle = values['welcome_title'] || null;
        const goodbyeTitle = values['goodbye_title'] || null;

        const welcomeOpts = values['welcome_view_options'] || [];
        const goodbyeOpts = values['goodbye_view_options'] || [];

        const welcomeShowTitle = welcomeOpts.includes('show_title') ? 1 : 0;
        const welcomeGenImage = welcomeOpts.includes('gen_image') ? 1 : 0;
        const welcomePlainText = welcomeOpts.includes('plain_text') ? 1 : 0;

        const goodbyeShowTitle = goodbyeOpts.includes('show_title') ? 1 : 0;
        const goodbyeGenImage = goodbyeOpts.includes('gen_image') ? 1 : 0;
        const goodbyePlainText = goodbyeOpts.includes('plain_text') ? 1 : 0;

        try {
            await pool.query(
                `INSERT INTO welcome_config (
                    guild_id, welcome_title, goodbye_title,
                    welcome_show_title, welcome_gen_image, welcome_plain_text,
                    goodbye_show_title, goodbye_gen_image, goodbye_plain_text
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    welcome_title = ?, goodbye_title = ?,
                    welcome_show_title = ?, welcome_gen_image = ?, welcome_plain_text = ?,
                    goodbye_show_title = ?, goodbye_gen_image = ?, goodbye_plain_text = ?`,
                [
                    guildId, welcomeTitle, goodbyeTitle,
                    welcomeShowTitle, welcomeGenImage, welcomePlainText,
                    goodbyeShowTitle, goodbyeGenImage, goodbyePlainText,
                    welcomeTitle, goodbyeTitle,
                    welcomeShowTitle, welcomeGenImage, welcomePlainText,
                    goodbyeShowTitle, goodbyeGenImage, goodbyePlainText
                ]
            );

            const updatedCfg = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateWelcomeConfigCache(guildId, updatedCfg[0]);
        } catch (err) {
            console.error('Modal view setup error:', err);
        }

        const panel = await buildWelcomeMainPanel(guildId, interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        return await interaction.editReply(panel);
    }

    return false;
}

module.exports = {
    handleWelcomeInteraction
};
