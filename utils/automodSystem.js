const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ButtonBuilder, ButtonStyle, ActionRowBuilder,
    MessageFlags
} = require('discord.js');
const { getAutoModConfig, pool } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

async function buildAutoModMainPanel(guildId) {
    let conn;
    let customCount = 0;
    let config = null;

    try {
        config = await getAutoModConfig(guildId);
        conn = await pool.getConnection();
        const wordRows = await conn.query('SELECT COUNT(*) AS cnt FROM filtered_words WHERE guild_id = ?', [guildId]);
        if (wordRows.length > 0) {
            customCount = Number(wordRows[0].cnt) || 0;
        }
    } catch (e) {
        console.error("AutoMod panel veri yükleme hatası:", e);
    } finally {
        if (conn) conn.release();
    }

    if (!config) {
        config = {
            anti_swear: false,
            custom_words_enabled: false,
            anti_invite: false,
            anti_link: false,
            caps_percent: 0,
            mention_limit: 0,
            spam_limit: '0',
            media_channels: null,
            exempt_roles: null,
            exempt_channels: null,
            punishment_type: 'delete',
            mute_duration: 10,
            dm_notify: true
        };
    }

    let mediaCount = 0;
    try {
        if (config.media_channels) {
            const arr = typeof config.media_channels === 'string' ? JSON.parse(config.media_channels) : config.media_channels;
            if (Array.isArray(arr)) mediaCount = arr.length;
        }
    } catch (e) {}

    // Durum Belirteçleri
    const swearStatus = config.anti_swear ? '`açık`' : '`kapalı`';
    const wordsStatus = (customCount > 0 || config.custom_words_enabled) ? `\`${customCount} kelime\`` : '`kapalı`';
    const inviteStatus = config.anti_invite ? '`açık`' : '`kapalı`';
    const linkStatus = config.anti_link ? '`açık`' : '`kapalı`';
    const capsStatus = (config.caps_percent > 0) ? `\`%${config.caps_percent}\`` : '`kapalı`';
    const mentionStatus = (config.mention_limit > 0) ? `\`${config.mention_limit} etiket\`` : '`kapalı`';
    const spamStatus = (config.spam_limit && config.spam_limit !== '0') ? `\`${config.spam_limit}\`` : '`kapalı`';
    const mediaStatus = (mediaCount > 0) ? `\`${mediaCount} kanal\`` : '`kapalı`';

    let activeFilterCount = 0;
    if (config.anti_swear) activeFilterCount++;
    if (customCount > 0 || config.custom_words_enabled) activeFilterCount++;
    if (config.anti_invite) activeFilterCount++;
    if (config.anti_link) activeFilterCount++;
    if (config.caps_percent > 0) activeFilterCount++;
    if (config.mention_limit > 0) activeFilterCount++;
    if (config.spam_limit && config.spam_limit !== '0') activeFilterCount++;
    if (mediaCount > 0) activeFilterCount++;

    let punishLabel = 'Mesaj silindi';
    if (config.punishment_type === 'warn') punishLabel = 'Mesaj silindi + Uyarı';
    else if (config.punishment_type === 'mute') punishLabel = `Mesaj silindi + Susturuldu (${config.mute_duration || 10} dk)`;

    const container = new ContainerBuilder();

    // 1. Başlık
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> AutoMod`)
    );

    // 2. Açıklama
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            "Mesajları otomatik denetle. Her filtre **ayrı ayrı** açılır; muaf rol ve kanal belirleyebilirsin.\n" +
            "**Mesajları Yönet** yetkisi olanlar tüm filtrelerden muaftır."
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Durum Listesi
    const statusText = 
        `- **Küfür filtresi** › ${swearStatus}\n` +
        `- **Yasaklı kelimeler** › ${wordsStatus}\n` +
        `- **Davet engeli** › ${inviteStatus}\n` +
        `- **Bağlantı engeli** › ${linkStatus}\n` +
        `- **Büyük harf** › ${capsStatus}\n` +
        `- **Toplu etiket** › ${mentionStatus}\n` +
        `- **Spam** › ${spamStatus}\n` +
        `- **Medya kanalları** › ${mediaStatus}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 4. Alt Durum Notu
    const footerStatus = activeFilterCount === 0
        ? `-# Henüz hiçbir filtre açılmamış.\n-# İhlal Cezası: **${punishLabel}**`
        : `-# Aktif Filtre Sayısı: **${activeFilterCount}/8**\n-# İhlal Cezası: **${punishLabel}**`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerStatus));

    // 5. Buton Satırları
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_filters_btn')
            .setLabel('Filtreler')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.shield || '1530917506867400775'),
        new ButtonBuilder()
            .setCustomId('automod_words_btn')
            .setLabel('Kelimeler')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.message_square || '1537768184851996702')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_media_btn')
            .setLabel('Medya Kanalları')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.images || '1537767777778143232'),
        new ButtonBuilder()
            .setCustomId('automod_roles_btn')
            .setLabel('Ceza Rolleri')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.shield || '1530917506867400775')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_exempt_btn')
            .setLabel('Muafiyetler')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.user || '1537768132062486558'),
        new ButtonBuilder()
            .setCustomId('automod_punish_btn')
            .setLabel('Ceza')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.warning || '1530917524609175562')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

module.exports = { buildAutoModMainPanel };
