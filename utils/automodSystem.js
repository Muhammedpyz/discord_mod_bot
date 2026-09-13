const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ButtonBuilder, ButtonStyle, ActionRowBuilder,
    MessageFlags
} = require('discord.js');
const { getAutoModConfig, pool, getAntiNukeConfig, getAntiNukeWhitelist } = require('../db');
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

    // Anti-Nuke kalkan durumu
    let shieldEnabled = false;
    try {
        const anConfig = await getAntiNukeConfig(guildId);
        shieldEnabled = Boolean(anConfig && anConfig.is_enabled);
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
    const zalgoStatus = (config.anti_zalgo !== false && config.anti_zalgo !== 0) ? '`açık`' : '`kapalı`';
    const emojiStatus = (config.emoji_limit > 0) ? `\`${config.emoji_limit} emoji\`` : '`kapalı`';
    const lineStatus = (config.line_limit > 0) ? `\`${config.line_limit} satır\`` : '`kapalı`';
    const repeatStatus = (config.repeat_limit > 0) ? `\`${config.repeat_limit} harf\`` : '`kapalı`';
    const crossSpamStatus = (config.cross_spam_enabled !== false && config.cross_spam_enabled !== 0) ? '`açık`' : '`kapalı`';

    let activeFilterCount = 0;
    if (config.anti_swear) activeFilterCount++;
    if (customCount > 0 || config.custom_words_enabled) activeFilterCount++;
    if (config.anti_invite) activeFilterCount++;
    if (config.anti_link) activeFilterCount++;
    if (config.caps_percent > 0) activeFilterCount++;
    if (config.mention_limit > 0) activeFilterCount++;
    if (config.spam_limit && config.spam_limit !== '0') activeFilterCount++;
    if (mediaCount > 0) activeFilterCount++;
    if (config.anti_zalgo !== false && config.anti_zalgo !== 0) activeFilterCount++;
    if (config.emoji_limit > 0) activeFilterCount++;
    if (config.line_limit > 0) activeFilterCount++;
    if (config.repeat_limit > 0) activeFilterCount++;
    if (config.cross_spam_enabled !== false && config.cross_spam_enabled !== 0) activeFilterCount++;

    let punishLabel = 'Mesaj silindi';
    if (config.punishment_type === 'warn') punishLabel = 'Mesaj silindi + Uyarı (Kademeli İzole)';
    else if (config.punishment_type === 'mute') punishLabel = `Mesaj silindi + Susturuldu (${config.mute_duration || 10} dk)`;

    const container = new ContainerBuilder();

    // 1. Başlık
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.shield || '1531753006708822076'}> AutoMod`)
    );

    // 2. Açıklama
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            "Mesajları otomatik denetle. Her filtre **ayrı ayrı** açılır; muaf rol ve kanal belirleyebilirsin.\n" +
            "İhlaller doğrudan sunucu izole ve uyarı sistemine (1. Uyarı -> 2. Uyarı -> 3. Uyarı/Banlısın Rolü) bağlanır."
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
        `- **Spam sınırı** › ${spamStatus}\n` +
        `- **Çapraz kanal raid** › ${crossSpamStatus}\n` +
        `- **Aşırı emoji baskını** › ${emojiStatus}\n` +
        `- **Satır atlama flood** › ${lineStatus}\n` +
        `- **Harf uzatma flood** › ${repeatStatus}\n` +
        `- **Zalgo bozuk metin** › ${zalgoStatus}\n` +
        `- **Medya kanalları** › ${mediaStatus}\n` +
        `- **Koruma kalkanı** › ${shieldEnabled ? '`açık`' : '`kapalı`'}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 4. Alt Durum Notu
    const footerStatus = activeFilterCount === 0
        ? `-# Henüz hiçbir filtre açılmamış.\n-# İhlal Cezası: **${punishLabel}**`
        : `-# Aktif Filtre Sayısı: **${activeFilterCount}/13**\n-# İhlal Cezası: **${punishLabel}**`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerStatus));

    // 5. Buton Satırları
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_filters_btn')
            .setLabel('Filtreler')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.shield || '1531753006708822076'),
        new ButtonBuilder()
            .setCustomId('automod_words_btn')
            .setLabel('Kelimeler')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.message_square || '1548248949549436998'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_btn')
            .setLabel('Koruma Kalkanı')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.shield || '1531753006708822076')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_media_btn')
            .setLabel('Medya Kanalları')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.image || '1548248313529114705'),
        new ButtonBuilder()
            .setCustomId('automod_exempt_btn')
            .setLabel('Muafiyetler')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.users || '1542629930108588153'),
        new ButtonBuilder()
            .setCustomId('automod_punish_btn')
            .setLabel('İhlal Cezası')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.warning || '1531752996768186428')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_flood_btn')
            .setLabel('Sohbet Kalkanı')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.siren || '1548248916875546756'),
        new ButtonBuilder()
            .setCustomId('automod_links_btn')
            .setLabel('İzinli Siteler')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.link || '1542629903134883880'),
        new ButtonBuilder()
            .setCustomId('automod_roles_btn')
            .setLabel('Ceza Rolleri')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.user_round_check || '1548248784503578634')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

module.exports = { buildAutoModMainPanel, buildAntiNukePanel };

// ============================================================
// KORUMA KALKANI (ANTI-NUKE) PANELİ
// ============================================================
const DEFAULT_LIMITS = {
    channel_delete_limit: 3,
    channel_create_limit: 3,
    role_delete_limit: 3,
    role_create_limit: 3,
    ban_limit: 4,
    kick_limit: 4
};

const PUNISHMENT_LABELS = {
    'strip_roles': 'Rolleri Al + Otorol Ver (Güvenli)',
    'kick': 'Sunucudan At (Kick)',
    'ban': 'Sunucudan Yasakla (Ban)'
};

async function buildAntiNukePanel(guildId) {
    let anConfig = null;
    let whitelist = [];

    try {
        anConfig = await getAntiNukeConfig(guildId);
        whitelist = await getAntiNukeWhitelist(guildId) || [];
    } catch (e) {
        console.error("Anti-Nuke panel veri yükleme hatası:", e);
    }

    anConfig = anConfig || {};
    const isEnabled = Boolean(anConfig.is_enabled);
    const punishment = PUNISHMENT_LABELS[anConfig.punishment] || 'Yönetici Rollerini Al';
    const logChannel = anConfig.log_channel_id;
    const limits = { ...DEFAULT_LIMITS, ...anConfig };

    const activeStatus = isEnabled
        ? `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> \`Aktif\``
        : `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> \`Kapalı\``;

    const antiBotStatus = anConfig.anti_bot_add !== false ? '`açık`' : '`kapalı`';
    const antiWebhookStatus = anConfig.anti_webhook !== false ? '`açık`' : '`kapalı`';
    const antiIntegrationStatus = anConfig.anti_integration !== false ? '`açık`' : '`kapalı`';
    const antiUnbanStatus = anConfig.anti_unban !== false ? '`açık`' : '`kapalı`';
    const antiServerStatus = anConfig.anti_server_update !== false ? '`açık`' : '`kapalı`';
    const antiEveryoneStatus = anConfig.anti_everyone_admin !== false ? '`açık`' : '`kapalı`';

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Koruma Kalkanı (Anti-Nuke)`)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            "Sunucunu baskınlardan ve yetkili saldırılarından korur.\n" +
            "Ultra Hızlı HTTP/2 REST Motoru ile seri kanal/rol silme, izinsiz bot, webhook, entegrasyon, sunucu bilgisi ve unban işlemleri anında engellenir."
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const statusText =
        `- **Kalkan durumu** › ${activeStatus} *(Tepki: HTTP/2 <15ms)*\n` +
        `- **Yaptırım türü** › \`${punishment}\`\n` +
        `- **Log kanalı** › ${logChannel ? `<#${logChannel}>` : '`ayarlanmadı`'}\n\n` +
        `**Özel Güvenlik Korumaları:**\n` +
        `- **Anti-Bot Add** › ${antiBotStatus}\n` +
        `- **Anti-Webhook** › ${antiWebhookStatus}\n` +
        `- **Anti-Integration** › ${antiIntegrationStatus}\n` +
        `- **Anti-Unban (Re-Ban)** › ${antiUnbanStatus}\n` +
        `- **Anti-Sunucu Güncelleme** › ${antiServerStatus}\n` +
        `- **Anti-Everyone Admin** › ${antiEveryoneStatus}\n\n` +
        `**Eşik Limitleri:**\n` +
        `- **Kanal silme/açma** › \`${limits.channel_delete_limit}\` / \`${limits.channel_create_limit}/10sn\`\n` +
        `- **Rol silme/açma** › \`${limits.role_delete_limit}\` / \`${limits.role_create_limit}/10sn\`\n` +
        `- **Toplu ban/kick** › \`${limits.ban_limit}\` / \`${limits.kick_limit}/10sn\`\n\n` +
        `- **Güvenli liste** › \`${whitelist.length}\` muaf`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_antinuke_toggle_btn')
            .setLabel(isEnabled ? 'Kalkanı Kapat' : 'Kalkanı Aç')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.power_off || '1537770135467860099'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_punish_btn')
            .setLabel('Yaptırım')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.hammer || '1537770036301668352'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_adv_btn')
            .setLabel('Gelişmiş Korumalar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(MONO_EMOJIS.shield || '1530917506867400775'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_limits_btn')
            .setLabel('Limitler')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.sliders_horizontal || '1537769889840889956')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('automod_antinuke_log_btn')
            .setLabel('Log Kanalı')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.bell || '1537768114555453561'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_whitelist_btn')
            .setLabel('Güvenli Liste')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.user_round_plus || '1537768051833831515'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_reset_btn')
            .setLabel('Sıfırla')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.rotate_ccw || '1537768179000938526'),
        new ButtonBuilder()
            .setCustomId('automod_antinuke_back_btn')
            .setLabel('Geri')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}