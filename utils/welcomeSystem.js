const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    MessageFlags
} = require('discord.js');
const { getWelcomeConfig } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

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

/**
 * Sub-View: Karşılama Ayarları Ekranı
 */
async function buildWelcomeSetupView(guildId) {
    const config = await getWelcomeConfig(guildId) || {};
    const channelText = config.welcome_channel_id ? `<#${config.welcome_channel_id}>` : '`kapalı`';
    const msgSnippet = config.welcome_message ? (config.welcome_message.length > 80 ? config.welcome_message.substring(0, 77) + '...' : config.welcome_message) : '`{user} sunucumuza hoş geldin!`';
    const dmSnippet = config.welcome_dm_message ? (config.welcome_dm_message.length > 80 ? config.welcome_dm_message.substring(0, 77) + '...' : config.welcome_dm_message) : '`kapalı`';

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## <:mono:${MONO_EMOJIS.sparkles || '1537767885978607716'}> Karşılama Ayarları\n\n` +
            `Aşağıdaki menüden kanalı seçebilir, karşılama mesajını veya DM metnini düzenleyebilirsin.`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `- **Mevcut Kanal ›** ${channelText}\n` +
            `- **Karşılama Mesajı ›** ${msgSnippet}\n` +
            `- **DM Mesajı ›** ${dmSnippet}`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${getMonoEmoji('info')} Kanalı kapatmak için "Kanalı Kapat" butonunu kullanabilirsin.`)
    );

    const rowChan = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('welcome_sel_channel')
            .setPlaceholder('Karşılama Kanalı Seçin...')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('welcome_btn_msg_modal')
            .setLabel('Karşılama Mesajı')
            .setEmoji(MONO_EMOJIS.pencil || MONO_EMOJIS.edit_2 || MONO_EMOJIS.settings)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('welcome_btn_dm_modal')
            .setLabel('DM Mesajı')
            .setEmoji(MONO_EMOJIS.mail || MONO_EMOJIS.message)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('welcome_btn_disable_channel')
            .setLabel('Kanalı Kapat')
            .setEmoji(MONO_EMOJIS.delete || MONO_EMOJIS.cross)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!config.welcome_channel_id),
        new ButtonBuilder()
            .setCustomId('welcome_btn_home')
            .setLabel('Ana Menüye Dön')
            .setEmoji(MONO_EMOJIS.arrow_left || MONO_EMOJIS.previous)
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowChan, rowBtns]
    };
}

/**
 * Sub-View: Uğurlama Ayarları Ekranı
 */
async function buildGoodbyeSetupView(guildId) {
    const config = await getWelcomeConfig(guildId) || {};
    const channelText = config.goodbye_channel_id ? `<#${config.goodbye_channel_id}>` : '`kapalı`';
    const msgSnippet = config.goodbye_message ? (config.goodbye_message.length > 80 ? config.goodbye_message.substring(0, 77) + '...' : config.goodbye_message) : '`{user} sunucumuzdan ayrıldı.`';

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## <:mono:${MONO_EMOJIS.user_minus || '1537768136084951140'}> Uğurlama Ayarları\n\n` +
            `Sunucudan ayrılan üyeler için uğurlama kanalını ve veda mesajını buradan yapılandırabilirsin.`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `- **Mevcut Kanal ›** ${channelText}\n` +
            `- **Uğurlama Mesajı ›** ${msgSnippet}`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${getMonoEmoji('info')} Uğurlama bildirimini kapatmak için "Kanalı Kapat" butonunu kullanabilirsin.`)
    );

    const rowChan = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('goodbye_sel_channel')
            .setPlaceholder('Uğurlama Kanalı Seçin...')
            .setChannelTypes(ChannelType.GuildText)
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('goodbye_btn_msg_modal')
            .setLabel('Uğurlama Mesajı')
            .setEmoji(MONO_EMOJIS.pencil || MONO_EMOJIS.edit_2 || MONO_EMOJIS.settings)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('goodbye_btn_disable_channel')
            .setLabel('Kanalı Kapat')
            .setEmoji(MONO_EMOJIS.delete || MONO_EMOJIS.cross)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!config.goodbye_channel_id),
        new ButtonBuilder()
            .setCustomId('welcome_btn_home')
            .setLabel('Ana Menüye Dön')
            .setEmoji(MONO_EMOJIS.arrow_left || MONO_EMOJIS.previous)
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowChan, rowBtns]
    };
}

/**
 * Sub-View: Görünüm & Biçim Ayarları Ekranı
 */
async function buildWelcomeViewSettings(guildId) {
    const config = await getWelcomeConfig(guildId) || {};

    let formatName = 'Kutulu Kart';
    let currentFormatVal = 'format_card';
    if (config.welcome_gen_image) {
        formatName = 'Görsel Kartlı (welcome.png)';
        currentFormatVal = 'format_image';
    } else if (config.welcome_plain_text) {
        formatName = 'Düz Metin (Kutusuz)';
        currentFormatVal = 'format_text';
    }

    const showTitle = config.welcome_show_title !== false && config.welcome_show_title !== 0;
    const titleText = config.welcome_title ? `\`${config.welcome_title}\`` : '`Varsayılan ("Hoş Geldin, {user}!")`';

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## <:mono:${MONO_EMOJIS.image || '1537767802751164486'}> Karşılama Görünüm & Biçim Ayarları\n\n` +
            `Mesajların kanalda nasıl görüneceğini aşağıdaki seçeneklerden yönetebilirsiniz.`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `- **Mesaj Biçimi ›** \`${formatName}\`\n` +
            `- **Kutu Başlığı Durumu ›** \`${showTitle ? 'Açık' : 'Kapalı'}\`\n` +
            `- **Özel Başlık Metni ›** ${titleText}`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${getMonoEmoji('info')} Görsel kart açıldığında kullanıcının avatarı ve sunucu bilgisiyle özel resim üretilir.`)
    );

    const rowFormat = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('welcome_sel_format')
            .setPlaceholder('Karşılama Formatı Seçin...')
            .addOptions([
                {
                    label: 'Görsel Kartlı (Önerilen)',
                    value: 'format_image',
                    description: 'Avatarlı, rozetli özel welcome.png görseli çizer',
                    default: currentFormatVal === 'format_image',
                    emoji: MONO_EMOJIS.image || MONO_EMOJIS.sparkles
                },
                {
                    label: 'Kutulu Kart',
                    value: 'format_card',
                    description: 'Components V2 modern koyu kutulu mesaj',
                    default: currentFormatVal === 'format_card',
                    emoji: MONO_EMOJIS.ticket || MONO_EMOJIS.folder
                },
                {
                    label: 'Düz Metin',
                    value: 'format_text',
                    description: 'Kutu veya görsel olmadan sade metin mesajı',
                    default: currentFormatVal === 'format_text',
                    emoji: MONO_EMOJIS.mail || MONO_EMOJIS.message
                }
            ])
    );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('welcome_btn_title_modal')
            .setLabel('Başlık Metni')
            .setEmoji(MONO_EMOJIS.pencil || MONO_EMOJIS.edit_2 || MONO_EMOJIS.settings)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('welcome_btn_toggle_title')
            .setLabel(showTitle ? 'Başlığı Kapat' : 'Başlığı Aç')
            .setEmoji(showTitle ? (MONO_EMOJIS.delete || MONO_EMOJIS.cross) : (MONO_EMOJIS.check || MONO_EMOJIS.verify))
            .setStyle(showTitle ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('welcome_btn_home')
            .setLabel('Ana Menüye Dön')
            .setEmoji(MONO_EMOJIS.arrow_left || MONO_EMOJIS.previous)
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowFormat, rowBtns]
    };
}

module.exports = {
    buildWelcomeMainPanel,
    buildWelcomeSetupView,
    buildGoodbyeSetupView,
    buildWelcomeViewSettings,
    parseWelcomePlaceholders,
    formatInviteDuration
};
