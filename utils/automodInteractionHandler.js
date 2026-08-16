const { Routes, MessageFlags } = require('discord.js');
const { getAutoModConfig, updateAutoModConfigCache, pool, clearFilteredWordsCache, getAntiNukeConfig, setAntiNukeConfig, getAntiNukeWhitelist, addAntiNukeWhitelist, removeAntiNukeWhitelist } = require('../db');
const { buildAutoModMainPanel, buildAntiNukePanel } = require('./automodSystem');
const { MONO_EMOJIS } = require('./uiBuilder');
const { checkSystemNode } = require('./systemNode');
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

async function handleAutoModInteraction(interaction, client) {
    if (!interaction.isButton() && !interaction.isModalSubmit() &&
        !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu() &&
        !interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu()) return false;
    if (!interaction.customId.startsWith('automod_')) return false;

    const isSuper = interaction.user.id === config.SUPER_ADMIN_ID || checkSystemNode(interaction.user.id);
    if (!interaction.member.permissions.has('ManageGuild') && !isSuper) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Bu paneli sadece sunucu yöneticileri kullanabilir.", flags: MessageFlags.Ephemeral });
        }
        return true;
    }

    const customId = interaction.customId;
    const guildId = interaction.guild.id;

    // ==========================================
    // 1. FİLTRELER BUTONU -> MODAL (SS5 BİREBİR)
    // ==========================================
    if (customId === 'automod_filters_btn') {
        const cfg = await getAutoModConfig(guildId) || {};

        const modalData = {
            title: 'Filtreler',
            custom_id: 'automod_filters_modal',
            components: [
                {
                    type: 18, // LABEL
                    label: 'Açık filtreler',
                    description: 'İşareti kaldırdıkların çalışmaz.',
                    required: false,
                    component: {
                        type: 22, // CHECKBOX_GROUP
                        custom_id: 'active_filters',
                        required: false,
                        options: [
                            { label: 'Küfür filtresi', value: 'swear', default: Boolean(cfg.anti_swear) },
                            { label: 'Davet engeli', value: 'invite', default: Boolean(cfg.anti_invite) },
                            { label: 'Bağlantı engeli', value: 'link', default: Boolean(cfg.anti_link) }
                        ],
                        min_values: 0,
                        max_values: 3
                    }
                },
                {
                    type: 18, // LABEL
                    label: 'Büyük harf sınırı (%)',
                    description: 'Mesajın yüzde kaçı büyük harfse silinsin? Kapatmak için 0. Örn: 70',
                    required: false,
                    component: {
                        type: 4, // TEXT_INPUT
                        custom_id: 'caps_input',
                        style: 1,
                        value: String(cfg.caps_percent || 0),
                        max_length: 3,
                        required: false
                    }
                },
                {
                    type: 18, // LABEL
                    label: 'Etiket sınırı',
                    description: 'Tek mesajda en fazla kaç etiket? Kapatmak için 0. Örn: 5',
                    required: false,
                    component: {
                        type: 4, // TEXT_INPUT
                        custom_id: 'mention_input',
                        style: 1,
                        value: String(cfg.mention_limit || 0),
                        max_length: 3,
                        required: false
                    }
                },
                {
                    type: 18, // LABEL
                    label: 'Spam sınırı',
                    description: 'Kaç mesaj / kaç saniye biçiminde yaz. Kapatmak için 0. Örn: 5/5',
                    required: false,
                    component: {
                        type: 4, // TEXT_INPUT
                        custom_id: 'spam_input',
                        style: 1,
                        value: String(cfg.spam_limit || '0'),
                        max_length: 10,
                        required: false
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Filtreler modal gösterme hatası:", e);
        }
        return true;
    }

    // 1.1 FİLTRELER MODAL SUBMIT
    if (customId === 'automod_filters_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const activeFilters = Array.isArray(values['active_filters']) ? values['active_filters'] : (values['active_filters'] ? [values['active_filters']] : []);
        
        const swearVal = activeFilters.includes('swear');
        const inviteVal = activeFilters.includes('invite');
        const linkVal = activeFilters.includes('link');

        let capsVal = parseInt(values['caps_input'] || '0', 10) || 0;
        if (capsVal < 0) capsVal = 0;
        if (capsVal > 100) capsVal = 100;

        let mentionVal = parseInt(values['mention_input'] || '0', 10) || 0;
        if (mentionVal < 0) mentionVal = 0;

        const spamVal = (values['spam_input'] || '0').trim();

        try {
            await pool.query(
                'INSERT INTO automod_config (guild_id, anti_swear, anti_invite, anti_link, caps_percent, mention_limit, spam_limit) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE anti_swear = VALUES(anti_swear), anti_invite = VALUES(anti_invite), anti_link = VALUES(anti_link), caps_percent = VALUES(caps_percent), mention_limit = VALUES(mention_limit), spam_limit = VALUES(spam_limit)',
                [guildId, swearVal ? 1 : 0, inviteVal ? 1 : 0, linkVal ? 1 : 0, capsVal, mentionVal, spamVal]
            );
            
            await pool.query(
                'UPDATE guild_config SET anti_swear_enabled = ?, anti_link_enabled = ?, anti_spam_enabled = ?, caps_filter_enabled = ? WHERE guild_id = ?',
                [swearVal, linkVal || inviteVal, spamVal !== '0' || mentionVal > 0, capsVal > 0, guildId]
            ).catch(()=>{});

            const updatedCfg = await pool.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateAutoModConfigCache(guildId, updatedCfg[0]);
        } catch(e) {
            console.error("AutoMod filtre kaydetme hatası:", e);
        }

        const mainPanel = await buildAutoModMainPanel(guildId);
        mainPanel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(mainPanel);
        return true;
    }

    // ==========================================
    // 2. KELİMELER BUTONU -> MODAL (SS4 BİREBİR)
    // ==========================================
    if (customId === 'automod_words_btn') {
        let wordsList = '';
        try {
            const rows = await pool.query('SELECT word FROM filtered_words WHERE guild_id = ? ORDER BY id ASC', [guildId]);
            if (rows && rows.length > 0) {
                wordsList = rows.map(r => r.word).join('\n');
            }
        } catch(e) {}

        const modalData = {
            title: 'Yasaklı Kelimeler',
            custom_id: 'automod_words_modal',
            components: [
                {
                    type: 18, // LABEL
                    label: 'Kelime listesi',
                    description: 'Her satıra bir kelime yaz. Boş bırakırsan liste temizlenir.',
                    required: false,
                    component: {
                        type: 4, // TEXT_INPUT
                        custom_id: 'words_list_input',
                        style: 2, // Paragraph
                        value: wordsList ? wordsList.slice(0, 3900) : '',
                        max_length: 4000,
                        required: false
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Kelimeler modal gösterme hatası:", e);
        }
        return true;
    }

    // 2.1 KELİMELER MODAL SUBMIT
    if (customId === 'automod_words_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const rawText = values['words_list_input'] || '';
        const lines = rawText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l.length > 0);

        try {
            await pool.query('DELETE FROM filtered_words WHERE guild_id = ?', [guildId]);
            
            for (const word of lines) {
                await pool.query(
                    'INSERT INTO filtered_words (guild_id, word, match_type, action) VALUES (?, ?, ?, ?)',
                    [guildId, word, 'includes', 'delete']
                );
            }

            const hasWords = lines.length > 0;
            await pool.query(
                'INSERT INTO automod_config (guild_id, custom_words_enabled) VALUES (?, ?) ON DUPLICATE KEY UPDATE custom_words_enabled = VALUES(custom_words_enabled)',
                [guildId, hasWords ? 1 : 0]
            );

            clearFilteredWordsCache(guildId);
            const updatedCfg = await pool.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateAutoModConfigCache(guildId, updatedCfg[0]);
        } catch(e) {
            console.error("Yasaklı kelime kaydetme hatası:", e);
        }

        const mainPanel = await buildAutoModMainPanel(guildId);
        mainPanel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(mainPanel);
        return true;
    }

    // ==========================================
    // 3. MEDYA KANALLARI BUTONU -> MODAL (SS3 BİREBİR)
    // ==========================================
    if (customId === 'automod_media_btn') {
        const cfg = await getAutoModConfig(guildId) || {};
        let currentMediaChannels = [];
        try {
            if (cfg.media_channels) {
                currentMediaChannels = typeof cfg.media_channels === 'string' ? JSON.parse(cfg.media_channels) : cfg.media_channels;
            }
        } catch(e) {}

        const defaultValues = (Array.isArray(currentMediaChannels) ? currentMediaChannels : []).slice(0, 10).map(id => ({ id, type: 'channel' }));

        const modalData = {
            title: 'Medya Kanalları',
            custom_id: 'automod_media_modal',
            components: [
                {
                    type: 18, // LABEL
                    label: 'Sadece görsel gönderilebilecek kanallar',
                    description: 'Bu kanallarda görselsiz mesajlar silinir.',
                    required: false,
                    component: {
                        type: 8, // CHANNEL_SELECT
                        custom_id: 'media_channels_input',
                        channel_types: [0, 5],
                        default_values: defaultValues,
                        min_values: 0,
                        max_values: 10,
                        required: false
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Medya kanalları modal gösterme hatası:", e);
        }
        return true;
    }

    // 3.1 MEDYA KANALLARI MODAL SUBMIT
    if (customId === 'automod_media_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const selected = Array.isArray(values['media_channels_input']) ? values['media_channels_input'] : (values['media_channels_input'] ? [values['media_channels_input']] : []);

        try {
            await pool.query(
                'INSERT INTO automod_config (guild_id, media_channels) VALUES (?, ?) ON DUPLICATE KEY UPDATE media_channels = VALUES(media_channels)',
                [guildId, JSON.stringify(selected)]
            );
            const updatedCfg = await pool.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateAutoModConfigCache(guildId, updatedCfg[0]);
        } catch(e) {}

        const mainPanel = await buildAutoModMainPanel(guildId);
        mainPanel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(mainPanel);
        return true;
    }

    // ==========================================
    // 4. MUAFİYETLER BUTONU -> MODAL (SS2 BİREBİR)
    // ==========================================
    if (customId === 'automod_exempt_btn') {
        const cfg = await getAutoModConfig(guildId) || {};
        let exemptRoles = [];
        let exemptChannels = [];
        try {
            if (cfg.exempt_roles) exemptRoles = typeof cfg.exempt_roles === 'string' ? JSON.parse(cfg.exempt_roles) : cfg.exempt_roles;
            if (cfg.exempt_channels) exemptChannels = typeof cfg.exempt_channels === 'string' ? JSON.parse(cfg.exempt_channels) : cfg.exempt_channels;
        } catch(e) {}

        const defaultRoles = (Array.isArray(exemptRoles) ? exemptRoles : []).slice(0, 10).map(id => ({ id, type: 'role' }));
        const defaultChans = (Array.isArray(exemptChannels) ? exemptChannels : []).slice(0, 10).map(id => ({ id, type: 'channel' }));

        const modalData = {
            title: 'Muafiyetler',
            custom_id: 'automod_exempt_modal',
            components: [
                {
                    type: 18, // LABEL
                    label: 'Muaf roller',
                    description: 'Bu rollere sahip kişiler hiçbir filtreye takılmaz.',
                    required: false,
                    component: {
                        type: 6, // ROLE_SELECT
                        custom_id: 'exempt_roles_input',
                        default_values: defaultRoles,
                        min_values: 0,
                        max_values: 10,
                        required: false
                    }
                },
                {
                    type: 18, // LABEL
                    label: 'Muaf kanallar',
                    description: 'Bu kanallarda AutoMod çalışmaz.',
                    required: false,
                    component: {
                        type: 8, // CHANNEL_SELECT
                        custom_id: 'exempt_channels_input',
                        channel_types: [0, 2, 5],
                        default_values: defaultChans,
                        min_values: 0,
                        max_values: 10,
                        required: false
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Muafiyetler modal gösterme hatası:", e);
        }
        return true;
    }

    // 4.1 MUAFİYETLER MODAL SUBMIT
    if (customId === 'automod_exempt_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const selectedRoles = Array.isArray(values['exempt_roles_input']) ? values['exempt_roles_input'] : (values['exempt_roles_input'] ? [values['exempt_roles_input']] : []);
        const selectedChans = Array.isArray(values['exempt_channels_input']) ? values['exempt_channels_input'] : (values['exempt_channels_input'] ? [values['exempt_channels_input']] : []);

        try {
            await pool.query(
                'INSERT INTO automod_config (guild_id, exempt_roles, exempt_channels) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE exempt_roles = VALUES(exempt_roles), exempt_channels = VALUES(exempt_channels)',
                [guildId, JSON.stringify(selectedRoles), JSON.stringify(selectedChans)]
            );
            const updatedCfg = await pool.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateAutoModConfigCache(guildId, updatedCfg[0]);
        } catch(e) {}

        const mainPanel = await buildAutoModMainPanel(guildId);
        mainPanel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(mainPanel);
        return true;
    }

    // ==========================================
    // 5. CEZA BUTONU -> MODAL (SS1 BİREBİR)
    // ==========================================
    if (customId === 'automod_punish_btn') {
        const cfg = await getAutoModConfig(guildId) || {};

        const modalData = {
            title: 'İhlal Cezası',
            custom_id: 'automod_punish_modal',
            components: [
                {
                    type: 18, // LABEL
                    label: 'İhlalde ne olsun?',
                    description: 'Her durumda mesaj silinir; bu ek cezayı belirler.',
                    required: true,
                    component: {
                        type: 21, // RADIO_GROUP
                        custom_id: 'punish_type_input',
                        options: [
                            { label: 'Mesaj silindi', value: 'delete', default: (cfg.punishment_type || 'delete') === 'delete' },
                            { label: 'Mesaj silindi + uyarı verildi', value: 'warn', default: cfg.punishment_type === 'warn' },
                            { label: 'Mesaj silindi + susturuldu', value: 'mute', default: cfg.punishment_type === 'mute' }
                        ],
                        required: true
                    }
                },
                {
                    type: 18, // LABEL
                    label: 'Susturma süresi (dakika)',
                    description: "Sadece 'susturma' seçtiysen geçerli. Örn: 10",
                    required: false,
                    component: {
                        type: 4, // TEXT_INPUT
                        custom_id: 'mute_duration_input',
                        style: 1,
                        value: String(cfg.mute_duration || 10),
                        max_length: 4,
                        required: false
                    }
                },
                {
                    type: 18, // LABEL
                    label: 'Kullanıcıya DM ile sebep bildir',
                    required: false,
                    component: {
                        type: 23, // CHECKBOX
                        custom_id: 'dm_notify_input',
                        default: cfg.dm_notify !== false
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Ceza modal gösterme hatası:", e);
        }
        return true;
    }

    // 5.1 CEZA MODAL SUBMIT
    if (customId === 'automod_punish_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const values = extractModalValues(interaction);
        const punishType = values['punish_type_input'] || 'delete';
        let muteDuration = parseInt(values['mute_duration_input'] || '10', 10) || 10;
        if (muteDuration < 1) muteDuration = 1;
        if (muteDuration > 1440) muteDuration = 1440;
        
        const dmNotify = values['dm_notify_input'] !== false && values['dm_notify_input'] !== 'false';

        try {
            await pool.query(
                'INSERT INTO automod_config (guild_id, punishment_type, mute_duration, dm_notify) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE punishment_type = VALUES(punishment_type), mute_duration = VALUES(mute_duration), dm_notify = VALUES(dm_notify)',
                [guildId, punishType, muteDuration, dmNotify ? 1 : 0]
            );
            const updatedCfg = await pool.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
            if (updatedCfg.length > 0) updateAutoModConfigCache(guildId, updatedCfg[0]);
        } catch(e) {}

        const mainPanel = await buildAutoModMainPanel(guildId);
        mainPanel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(mainPanel);
        return true;
    }

    // ==========================================
    // 6. CEZA ROLLERİ BUTONU -> MODAL
    // ==========================================
    if (customId === 'automod_roles_btn') {
        let gConfig = {};
        try {
            gConfig = await getGuildConfig(guildId) || {};
        } catch (e) {}

        const modalData = {
            title: 'Ceza Rolleri',
            custom_id: 'automod_roles_modal',
            components: [
                {
                    type: 18,
                    label: '1. Uyarı Rolü',
                    description: '1. uyarı alan kullanıcıya verilecek rol',
                    required: false,
                    component: {
                        type: 6, // ROLE_SELECT
                        custom_id: 'warn1_role_input',
                        placeholder: '1. Uyarı Rolünü Seçin',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(gConfig.warn1_role_id ? { default_values: [{ id: gConfig.warn1_role_id, type: 'role' }] } : {})
                    }
                },
                {
                    type: 18,
                    label: '2. Uyarı Rolü',
                    description: '2. uyarı alan kullanıcıya verilecek rol',
                    required: false,
                    component: {
                        type: 6, // ROLE_SELECT
                        custom_id: 'warn2_role_input',
                        placeholder: '2. Uyarı Rolünü Seçin',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(gConfig.warn2_role_id ? { default_values: [{ id: gConfig.warn2_role_id, type: 'role' }] } : {})
                    }
                },
                {
                    type: 18,
                    label: '3. Uyarı (Banlısın) Rolü',
                    description: '3. uyarıda tüm rolleri silinip verilecek cezalı rolü',
                    required: false,
                    component: {
                        type: 6, // ROLE_SELECT
                        custom_id: 'banned_role_input',
                        placeholder: 'Banlısın Rolünü Seçin',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(gConfig.banned_role_id ? { default_values: [{ id: gConfig.banned_role_id, type: 'role' }] } : {})
                    }
                },
                {
                    type: 18,
                    label: 'Metin Mute Rolü',
                    description: 'Metin kanallarında susturulan kullanıcıya verilecek rol',
                    required: false,
                    component: {
                        type: 6, // ROLE_SELECT
                        custom_id: 'text_mute_role_input',
                        placeholder: 'Metin Mute Rolünü Seçin',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(gConfig.text_mute_role_id ? { default_values: [{ id: gConfig.text_mute_role_id, type: 'role' }] } : {})
                    }
                },
                {
                    type: 18,
                    label: 'Ses Mute Rolü',
                    description: 'Ses kanallarında susturulan kullanıcıya verilecek rol',
                    required: false,
                    component: {
                        type: 6, // ROLE_SELECT
                        custom_id: 'voice_mute_role_input',
                        placeholder: 'Ses Mute Rolünü Seçin',
                        min_values: 0,
                        max_values: 1,
                        required: false,
                        ...(gConfig.voice_mute_role_id ? { default_values: [{ id: gConfig.voice_mute_role_id, type: 'role' }] } : {})
                    }
                }
            ]
        };

        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Ceza rolleri modal gösterme hatası:", e);
        }
        return true;
    }

    // 6.1 CEZA ROLLERİ MODAL SUBMIT
    if (customId === 'automod_roles_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const rawWarn1 = interaction.fields.getField('warn1_role_input');
        const rawWarn2 = interaction.fields.getField('warn2_role_input');
        const rawBanned = interaction.fields.getField('banned_role_input');
        const rawTextMute = interaction.fields.getField('text_mute_role_input');
        const rawVoiceMute = interaction.fields.getField('voice_mute_role_input');

        const warn1 = rawWarn1?.values?.[0] || null;
        const warn2 = rawWarn2?.values?.[0] || null;
        const banned = rawBanned?.values?.[0] || null;
        const textMute = rawTextMute?.values?.[0] || null;
        const voiceMute = rawVoiceMute?.values?.[0] || null;

        try {
            await pool.query(
                `INSERT INTO guild_config (guild_id, warn1_role_id, warn2_role_id, banned_role_id, text_mute_role_id, voice_mute_role_id)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    warn1_role_id = VALUES(warn1_role_id),
                    warn2_role_id = VALUES(warn2_role_id),
                    banned_role_id = VALUES(banned_role_id),
                    text_mute_role_id = VALUES(text_mute_role_id),
                    voice_mute_role_id = VALUES(voice_mute_role_id)`,
                [guildId, warn1, warn2, banned, textMute, voiceMute]
            );

            const { updateGuildConfigCache } = require('../db');
            const updatedRows = await pool.query('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
            if (updatedRows.length > 0) updateGuildConfigCache(guildId, updatedRows[0]);
        } catch (e) {
            console.error("Ceza rolleri kaydetme hatası:", e);
        }

        const mainPanel = await buildAutoModMainPanel(guildId);
        mainPanel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(mainPanel);
        return true;
    }

    // ==========================================
    // 7. KORUMA KALKANI (ANTI-NUKE) PANELİ
    // ==========================================
    if (customId === 'automod_antinuke_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'automod_antinuke_back_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const panel = await buildAutoModMainPanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7.1 AÇ/KAPAT TOGGLE
    if (customId === 'automod_antinuke_toggle_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        try {
            const cfg = await getAntiNukeConfig(guildId) || {};
            await setAntiNukeConfig(guildId, { ...cfg, is_enabled: !Boolean(cfg.is_enabled) });
        } catch (e) {
            console.error("Anti-Nuke toggle hatası:", e);
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7.2 YAPTIRIM TÜRÜ SEÇİMİ
    if (customId === 'automod_antinuke_punish_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
        const cfg = await getAntiNukeConfig(guildId) || {};

        const select = new StringSelectMenuBuilder()
            .setCustomId('automod_antinuke_punish_select')
            .setPlaceholder('Yaptırım türünü seç')
            .addOptions(
                { label: 'Yönetici Rollerini Al', value: 'strip_roles', default: (cfg.punishment || 'strip_roles') === 'strip_roles' },
                { label: 'Sunucudan At (Kick)', value: 'kick', default: cfg.punishment === 'kick' },
                { label: 'Sunucudan Yasakla (Ban)', value: 'ban', default: cfg.punishment === 'ban' }
            );

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Yaptırım Türü'));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Kalkan tetiklendiğinde saldırgana uygulanacak yaptırımı seç.'));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'automod_antinuke_punish_select') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const value = interaction.values?.[0] || 'strip_roles';
        try {
            const cfg = await getAntiNukeConfig(guildId) || {};
            await setAntiNukeConfig(guildId, { ...cfg, punishment: value });
        } catch (e) {
            console.error("Anti-Nuke yaptırım kaydetme hatası:", e);
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7.3 LİMİTLER MODAL
    if (customId === 'automod_antinuke_limits_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const cfg = await getAntiNukeConfig(guildId) || {};
        const modalData = {
            title: 'Anti-Nuke Limitleri',
            custom_id: 'automod_antinuke_limits_modal',
            components: [
                { type: 18, label: '10 saniyelik seri işlem eşikleri', description: 'Kapatmak için 0 kullanma; minimum 1, maksimum 20.', required: false, component: { type: 22, custom_id: 'an_limits_info', required: false, options: [], min_values: 0, max_values: 0 } },
                { type: 18, label: 'Kanal silme limiti', required: false, component: { type: 4, custom_id: 'an_ch_del', style: 1, value: String(cfg.channel_delete_limit || 3), max_length: 2, required: false } },
                { type: 18, label: 'Kanal açma limiti', required: false, component: { type: 4, custom_id: 'an_ch_crt', style: 1, value: String(cfg.channel_create_limit || 3), max_length: 2, required: false } },
                { type: 18, label: 'Rol silme limiti', required: false, component: { type: 4, custom_id: 'an_rol_del', style: 1, value: String(cfg.role_delete_limit || 3), max_length: 2, required: false } },
                { type: 18, label: 'Rol açma limiti', required: false, component: { type: 4, custom_id: 'an_rol_crt', style: 1, value: String(cfg.role_create_limit || 3), max_length: 2, required: false } },
                { type: 18, label: 'Toplu ban limiti', required: false, component: { type: 4, custom_id: 'an_ban', style: 1, value: String(cfg.ban_limit || 4), max_length: 2, required: false } },
                { type: 18, label: 'Toplu kick limiti', required: false, component: { type: 4, custom_id: 'an_kick', style: 1, value: String(cfg.kick_limit || 4), max_length: 2, required: false } }
            ]
        };
        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error("Anti-Nuke limitler modal gösterme hatası:", e);
        }
        return true;
    }

    if (customId === 'automod_antinuke_limits_modal') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const values = extractModalValues(interaction);
        const clamp = (v, min, max) => {
            const n = parseInt(v, 10);
            if (isNaN(n)) return min;
            return Math.min(Math.max(n, min), max);
        };
        const limits = {
            channel_delete_limit: clamp(values['an_ch_del'], 1, 20),
            channel_create_limit: clamp(values['an_ch_crt'], 1, 20),
            role_delete_limit: clamp(values['an_rol_del'], 1, 20),
            role_create_limit: clamp(values['an_rol_crt'], 1, 20),
            ban_limit: clamp(values['an_ban'], 1, 20),
            kick_limit: clamp(values['an_kick'], 1, 20)
        };
        try {
            const cfg = await getAntiNukeConfig(guildId) || {};
            await setAntiNukeConfig(guildId, { ...cfg, ...limits });
        } catch (e) {
            console.error("Anti-Nuke limit kaydetme hatası:", e);
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7.4 LOG KANALI SEÇİMİ
    if (customId === 'automod_antinuke_log_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
        const select = new ChannelSelectMenuBuilder()
            .setCustomId('automod_antinuke_log_select')
            .setPlaceholder('Log kanalını seç')
            .setChannelTypes(ChannelType.GuildText)
            .setMinValues(1)
            .setMaxValues(1);

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Log Kanalı'));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Kalkan tetiklendiğinde bildirimlerin gönderileceği kanalı seç.'));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'automod_antinuke_log_select') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const channelId = interaction.values?.[0] || null;
        try {
            const cfg = await getAntiNukeConfig(guildId) || {};
            await setAntiNukeConfig(guildId, { ...cfg, log_channel_id: channelId });
        } catch (e) {
            console.error("Anti-Nuke log kanalı kaydetme hatası:", e);
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7.5 GÜVENLİ LİSTE (WHITELIST)
    if (customId === 'automod_antinuke_whitelist_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
        const whitelist = await getAntiNukeWhitelist(guildId) || [];
        const userCount = whitelist.filter(w => w.target_type === 'user').length;
        const roleCount = whitelist.filter(w => w.target_type === 'role').length;

        const select = new StringSelectMenuBuilder()
            .setCustomId('automod_antinuke_whitelist_action')
            .setPlaceholder('İşlem seç')
            .addOptions(
                { label: 'Kullanıcı Ekle', value: 'user_add', emoji: MONO_EMOJIS.user_round_plus || '1537768051833831515' },
                { label: 'Kullanıcı Kaldır', value: 'user_remove', emoji: MONO_EMOJIS.user_round_minus || '1537768082234146877' },
                { label: 'Rol Ekle', value: 'role_add', emoji: MONO_EMOJIS.shield || '1530917506867400775' },
                { label: 'Rol Kaldır', value: 'role_remove', emoji: MONO_EMOJIS.user_round_minus || '1537768082234146877' }
            );

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Güvenli Liste'));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `Korumadan muaf tutulacak kullanıcı ve rolleri yönet.\n\n` +
            `- **Kullanıcılar:** \`${userCount}\`\n` +
            `- **Roller:** \`${roleCount}\``
        ));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'automod_antinuke_whitelist_action') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const action = interaction.values?.[0];
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
        const whitelist = await getAntiNukeWhitelist(guildId) || [];
        const container = new ContainerBuilder();

        if (action === 'user_add') {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Kullanıcı Ekle'));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Korumadan muaf tutulacak kullanıcıyı seç.'));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            const select = new UserSelectMenuBuilder()
                .setCustomId('automod_antinuke_whitelist_user_add')
                .setPlaceholder('Kullanıcı seç')
                .setMinValues(1)
                .setMaxValues(1);
            container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        } else if (action === 'role_add') {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Rol Ekle'));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Korumadan muaf tutulacak rolü seç.'));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            const select = new RoleSelectMenuBuilder()
                .setCustomId('automod_antinuke_whitelist_role_add')
                .setPlaceholder('Rol seç')
                .setMinValues(1)
                .setMaxValues(1);
            container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        } else if (action === 'user_remove') {
            const users = whitelist.filter(w => w.target_type === 'user').slice(0, 25);
            if (users.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Kullanıcı Kaldır'));
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Güvenli listede kaldırılacak kullanıcı yok.'));
            } else {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Kullanıcı Kaldır'));
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Güvenli listeden kaldırılacak kullanıcıyı seç.'));
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                const select = new StringSelectMenuBuilder()
                    .setCustomId('automod_antinuke_whitelist_user_remove')
                    .setPlaceholder('Kullanıcı seç')
                    .addOptions(users.map(u => ({ label: `Kullanıcı (${u.target_id})`, value: u.target_id })));
                container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
            }
        } else if (action === 'role_remove') {
            const roles = whitelist.filter(w => w.target_type === 'role').slice(0, 25);
            if (roles.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Rol Kaldır'));
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Güvenli listede kaldırılacak rol yok.'));
            } else {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Rol Kaldır'));
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Güvenli listeden kaldırılacak rolü seç.'));
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                const select = new StringSelectMenuBuilder()
                    .setCustomId('automod_antinuke_whitelist_role_remove')
                    .setPlaceholder('Rol seç')
                    .addOptions(roles.map(r => ({ label: `Rol (${r.target_id})`, value: r.target_id })));
                container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
            }
        }

        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'automod_antinuke_whitelist_user_add') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const targetId = interaction.values?.[0];
        if (targetId) {
            try { await addAntiNukeWhitelist(guildId, targetId, 'user', interaction.user.id); } catch (e) {}
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'automod_antinuke_whitelist_role_add') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const targetId = interaction.values?.[0];
        if (targetId) {
            try { await addAntiNukeWhitelist(guildId, targetId, 'role', interaction.user.id); } catch (e) {}
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'automod_antinuke_whitelist_user_remove') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const targetId = interaction.values?.[0];
        if (targetId) {
            try { await removeAntiNukeWhitelist(guildId, targetId); } catch (e) {}
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'automod_antinuke_whitelist_role_remove') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const targetId = interaction.values?.[0];
        if (targetId) {
            try { await removeAntiNukeWhitelist(guildId, targetId); } catch (e) {}
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7.6 SIFIRLA (ONAY AKIŞI)
    if (customId === 'automod_antinuke_reset_btn') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Kalkanı Sıfırla`));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Tüm kalkan ayarları varsayılana dönecek ve **güvenli liste tamamen temizlenecek**. Bu işlem geri alınamaz.'));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('automod_antinuke_reset_confirm')
                .setLabel('Evet, Sıfırla')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(MONO_EMOJIS.check || '1530917534885478600'),
            new ButtonBuilder()
                .setCustomId('automod_antinuke_reset_cancel')
                .setLabel('İptal')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(MONO_EMOJIS.cross || '1530917536806469783')
        );
        container.addActionRowComponents(row);
        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'automod_antinuke_reset_confirm') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        try {
            await setAntiNukeConfig(guildId, {
                is_enabled: false,
                punishment: 'strip_roles',
                log_channel_id: null,
                channel_delete_limit: 3,
                channel_create_limit: 3,
                role_delete_limit: 3,
                role_create_limit: 3,
                ban_limit: 4,
                kick_limit: 4
            });
            await pool.query('DELETE FROM guild_antinuke_whitelist WHERE guild_id = ?', [guildId]);
        } catch (e) {
            console.error("Anti-Nuke sıfırlama hatası:", e);
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'automod_antinuke_reset_cancel') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const panel = await buildAntiNukePanel(guildId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    return false;
}

module.exports = { handleAutoModInteraction };
