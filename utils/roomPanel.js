const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const { MONO_EMOJIS } = require('./uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

function createRoomPanel(owner, channelId) {
    let isLocked = false;
    let isHidden = false;
    let isStreamAllowed = true;
    let userLimit = 0;
    let bitrateKbps = 64;

    const channel = owner.client?.channels?.cache?.get(channelId);
    if (channel) {
        userLimit = channel.userLimit || 0;
        bitrateKbps = channel.bitrate ? Math.round(channel.bitrate / 1000) : 64;
        const everyoneRole = channel.guild.roles.everyone;
        const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
        if (overwrite) {
            if (overwrite.deny.has(PermissionFlagsBits.Connect)) isLocked = true;
            if (overwrite.deny.has(PermissionFlagsBits.ViewChannel)) isHidden = true;
            if (overwrite.deny.has(PermissionFlagsBits.Stream)) isStreamAllowed = false;
        }
    }

    const container = new ContainerBuilder();
    container.setAccentColor(0x000000); // Pure Stealth Black

    // 1. Header & Description
    const eSettings = getMonoEmoji('settings') || getMonoEmoji('gear');
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eSettings} Özel Ses Odası Arayüzü\nOdanızı yönetmek ve erişim izinlerini düzenlemek için aşağıdaki kontrolleri kullanın.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Structured Status Block (VoiceMaster / Stealth Minimalist Style)
    const eOwner = getMonoEmoji('crown') || getMonoEmoji('user');
    const eLock = isLocked ? getMonoEmoji('lock') : getMonoEmoji('unlock');
    const eEye = isHidden ? (getMonoEmoji('folder_x') || getMonoEmoji('status')) : getMonoEmoji('status');
    const eUsers = getMonoEmoji('users') || getMonoEmoji('user');
    const eVideo = getMonoEmoji('video') || getMonoEmoji('tv_2') || getMonoEmoji('sparkles');
    const eBitrate = getMonoEmoji('volume_2') || getMonoEmoji('volume') || getMonoEmoji('headphones');

    const limitText = userLimit === 0 ? 'Sınırsız' : `${userLimit} Kişi`;
    const lockText = isLocked ? 'Kilitli' : 'Herkese Açık';
    const hideText = isHidden ? 'Gizli' : 'Görünür';
    const streamText = isStreamAllowed ? 'Serbest' : 'Sadece Sahip';

    const infoLines = [
        `${eOwner} **Oda Sahibi ›** <@${owner.id}>`,
        `${eLock} **Kilit ›** \`${lockText}\` · ${eEye} **Görünürlük ›** \`${hideText}\``,
        `${eUsers} **Kişi Limiti ›** \`${limitText}\` · ${eBitrate} **Ses Kalitesi ›** \`${bitrateKbps} kbps\``,
        `${eVideo} **Yayın İzni ›** \`${streamText}\``
    ].join('\n');

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(infoLines));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Subtext Tip
    const eInfo = getMonoEmoji('info') || getMonoEmoji('sparkles');
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${eInfo} Sahip ayrıldığında oda açık kalır; odadaki herhangi bir üye **Sahiplen** butonuyla odayı devralabilir.`)
    );

    // 4. Buttons: 3 Clean Rows of Grey Secondary Buttons with Mono Emojis
    // Satır 1: Erişim & Gizlilik & Sahiplenme & İsim
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(isLocked ? 'room_unlock' : 'room_lock')
            .setLabel(isLocked ? 'Kilidi Aç' : 'Kilitle')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(isLocked ? MONO_EMOJIS.unlock : MONO_EMOJIS.lock),
        new ButtonBuilder()
            .setCustomId(isHidden ? 'room_show' : 'room_hide')
            .setLabel(isHidden ? 'Göster' : 'Gizle')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.status || MONO_EMOJIS.folder),
        new ButtonBuilder()
            .setCustomId('room_claim_ownership')
            .setLabel('Sahiplen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.crown || MONO_EMOJIS.trophy),
        new ButtonBuilder()
            .setCustomId('room_rename_btn')
            .setLabel('İsim')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.pencil || MONO_EMOJIS.edit_2 || MONO_EMOJIS.settings)
    );

    // Satır 2: Üye Yönetimi & Hızlı Limit Kontrolleri
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('room_kick_menu_btn')
            .setLabel('Üye At')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.kick || MONO_EMOJIS.delete),
        new ButtonBuilder()
            .setCustomId('room_limit_inc')
            .setLabel('+1 Limit')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.add),
        new ButtonBuilder()
            .setCustomId('room_limit_dec')
            .setLabel('-1 Limit')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.arrow_left || MONO_EMOJIS.previous),
        new ButtonBuilder()
            .setCustomId('room_limit_btn')
            .setLabel('Özel Limit')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.users)
    );

    // Satır 3: İzinler, Kalite & Kapatma
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('room_whitelist_btn')
            .setLabel('Beyaz Liste')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.shield || MONO_EMOJIS.shield_check),
        new ButtonBuilder()
            .setCustomId(isStreamAllowed ? 'room_stream_disable' : 'room_stream_enable')
            .setLabel(isStreamAllowed ? 'Yayını Kapat' : 'Yayını Aç')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.video || MONO_EMOJIS.tv_2 || MONO_EMOJIS.camera),
        new ButtonBuilder()
            .setCustomId('room_bitrate_btn')
            .setLabel('Ses Kalitesi')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.volume_2 || MONO_EMOJIS.volume || MONO_EMOJIS.headphones),
        new ButtonBuilder()
            .setCustomId('room_manage_users_btn')
            .setLabel('Üye İzinleri')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.user || MONO_EMOJIS.people),
        new ButtonBuilder()
            .setCustomId('room_delete')
            .setLabel('Odayı Kapat')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.delete || MONO_EMOJIS.cross)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, row1, row2, row3]
    };
}

module.exports = { createRoomPanel };
