const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags
} = require('discord.js');
const { getWelcomeConfig } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

/**
 * Formats invite duration/expiration
 */
function formatInviteDuration(durationOrMaxAge, expiresTimestamp, forCard = false) {
    if (typeof durationOrMaxAge === 'string') return durationOrMaxAge;
    if (!durationOrMaxAge && !expiresTimestamp) return 'Süresiz (Kalıcı)';
    if (durationOrMaxAge === 0) return 'Süresiz (Kalıcı)';

    if (expiresTimestamp) {
        if (forCard) {
            const diffMs = expiresTimestamp - Date.now();
            if (diffMs <= 0) return 'Süresi Dolmuş';
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            const diffDays = Math.round(diffHours / 24);
            if (diffDays >= 1) return `${diffDays} Gün`;
            return `${diffHours} Saat`;
        }
        return `<t:${Math.floor(expiresTimestamp / 1000)}:R>`;
    }

    if (durationOrMaxAge) {
        const hours = Math.round(durationOrMaxAge / 3600);
        const days = Math.round(hours / 24);
        if (days >= 1) return `${days} Gün`;
        return `${hours} Saat`;
    }
    return 'Süresiz (Kalıcı)';
}

/**
 * Replaces all placeholders in message template
 * @param {string} text - Raw text with variables
 * @param {GuildMember} member - Discord Guild Member
 * @param {Object} inviter - Inviter User
 * @param {number} inviteCount - Inviter count
 * @param {string} inviteCode - Invite code used
 * @param {any} inviteDuration - Invite duration / maxAge / expires
 * @param {any} inviteMaxUses - Max uses allowed on invite
 * @param {boolean} forCard - Whether to format for image card
 */
function parseWelcomePlaceholders(text, member, inviter = null, inviteCount = 0, inviteCode = null, inviteDuration = null, inviteMaxUses = null, forCard = false) {
    if (!text) return '';
    const count = member?.guild?.memberCount || 1;
    
    // Davet eden kişi
    const inviterMention = forCard
        ? (inviter ? (inviter.username || inviter.tag || 'Kurucu') : 'Özel Davet / Vanity')
        : (inviter ? `<@${inviter.id}>` : '`Özel Davet / Vanity`');
    
    // Davet kodu ve linki
    const codeStr = inviteCode || (member?.guild?.vanityURLCode || '');
    const linkStr = codeStr ? `discord.gg/${codeStr}` : '';
    const inviteTypeStr = inviter ? 'Üye Daveti' : (member?.guild?.vanityURLCode ? 'Özel URL (Vanity)' : 'Doğrudan Katılım');

    // Davet süresi ve kullanım limiti
    const durationStr = inviteDuration ? formatInviteDuration(inviteDuration, null, forCard) : '';
    let maxUsesStr = '';
    if (inviteMaxUses && typeof inviteMaxUses === 'number' && inviteMaxUses > 0) {
        maxUsesStr = `${inviteMaxUses} Kullanım`;
    } else if (typeof inviteMaxUses === 'string') {
        maxUsesStr = inviteMaxUses;
    }

    const userMention = forCard
        ? `@${member?.user?.username || member?.displayName || 'Kullanıcı'}`
        : `<@${member?.id}>`;
    const emojiText = forCard ? '' : `<:mono:${MONO_EMOJIS.sparkles || '1537767885978607716'}>`;

    let res = text
        .replace(/{user}/g, userMention)
        .replace(/{user\.name}/g, member?.user?.username || 'Kullanıcı')
        .replace(/{user\.id}/g, member?.id || '')
        .replace(/{user\.tag}/g, member?.user?.tag || member?.user?.username || 'Kullanıcı')
        .replace(/{server}/g, member?.guild?.name || 'Sunucu')
        .replace(/{server\.id}/g, member?.guild?.id || '')
        .replace(/{count}/g, count.toString())
        .replace(/{count\.ordinal}/g, `${count}.`)
        .replace(/{memberCount}/g, count.toString())
        .replace(/{emoji}/g, emojiText)
        .replace(/{davet}/g, inviterMention)
        .replace(/{davet\.sayı}/g, (inviteCount || 0).toString())
        .replace(/{davet\.kod}/g, codeStr)
        .replace(/{davet\.link}/g, linkStr)
        .replace(/{davet\.tür}/g, inviteTypeStr)
        .replace(/{davet\.süre}/g, durationStr)
        .replace(/{davet\.maxKullanım}/g, maxUsesStr);

    if (forCard) {
        // Strip markdown asterisks, backticks, strikethroughs, mono tags, and raw unicode emojis from image text
        res = res
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/[`*_~]/g, '')
            .replace(/<:mono:\d+>/g, '')
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
            .trim();
    }
    return res;
}

/**
 * Builds the main /hosgeldin V2 Dashboard matching screenshot
 */
async function buildWelcomeMainPanel(guildId, guild = null) {
    const config = await getWelcomeConfig(guildId) || {};

    // Validate channels exist in guild
    let welcomeValid = config.welcome_channel_id;
    let goodbyeValid = config.goodbye_channel_id;
    if (guild) {
        if (welcomeValid && !guild.channels.cache.has(welcomeValid)) welcomeValid = null;
        if (goodbyeValid && !guild.channels.cache.has(goodbyeValid)) goodbyeValid = null;
    }

    const welcomeChannelText = welcomeValid ? `<#${welcomeValid}>` : '`kapalı`';
    const goodbyeChannelText = goodbyeValid ? `<#${goodbyeValid}>` : '`kapalı`';
    const dmText = config.welcome_dm_message ? '`açık`' : '`kapalı`';

    let formatText = '`kutulu kart`';
    if (config.welcome_plain_text) {
        formatText = '`düz metin`';
    } else if (config.welcome_gen_image) {
        formatText = '`görsel kartlı`';
    }

    const container = new ContainerBuilder();

    // 1. Header
    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.sparkles || '1537767885978607716'}> Karşılama Sistemi\n\n` +
        `Sunucuna katılan ve ayrılan üyeler için mesaj ayarla.\n` +
        `Görsel kart açarsan üyenin avatarıyla özel bir karşılama görseli üretilir.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Status Indicators
    const statusText =
        `- **Karşılama ›** ${welcomeChannelText}\n` +
        `- **Mesaj biçimi ›** ${formatText}\n` +
        `- **DM mesajı ›** ${dmText}\n` +
        `- **Uğurlama ›** ${goodbyeChannelText}`;

    const statusDisplay = new TextDisplayBuilder().setContent(statusText);
    container.addTextDisplayComponents(statusDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Variables List
    const varsText =
        `**Kullanabileceğin değişkenler:**\n` +
        `\`{user}\` \`{user.name}\` \`{user.id}\` \`{user.tag}\` \`{server}\` \`{server.id}\` ` +
        `\`{count}\` \`{count.ordinal}\` \`{memberCount}\` \`{emoji}\`\n` +
        `\`{davet}\` \`{davet.sayı}\` \`{davet.kod}\` \`{davet.link}\` \`{davet.tür}\` \`{davet.süre}\` \`{davet.maxKullanım}\``;

    const varsDisplay = new TextDisplayBuilder().setContent(varsText);
    container.addTextDisplayComponents(varsDisplay);

    // 4. Buttons (ActionRows)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('welcome_btn_setup')
            .setLabel('Karşılama')
            .setEmoji(MONO_EMOJIS.sparkles || '1537767885978607716')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('goodbye_btn_setup')
            .setLabel('Uğurlama')
            .setEmoji(MONO_EMOJIS.user_minus || '1537768136084951140')
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('welcome_btn_view')
            .setLabel('Görünüm')
            .setEmoji(MONO_EMOJIS.image || '1537767802751164486')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('welcome_btn_test')
            .setLabel('Test Et')
            .setEmoji(MONO_EMOJIS.refresh_cw || '1537768206989791232')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!welcomeValid)
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

module.exports = {
    buildWelcomeMainPanel,
    parseWelcomePlaceholders,
    formatInviteDuration
};
