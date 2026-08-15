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

    // Kanal izinlerinden kilit ve gizlilik durumunu al
    const channel = owner.client?.channels?.cache?.get(channelId);
    if (channel) {
        const everyoneRole = channel.guild.roles.everyone;
        const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
        if (overwrite) {
            if (overwrite.deny.has(PermissionFlagsBits.Connect)) isLocked = true;
            if (overwrite.deny.has(PermissionFlagsBits.ViewChannel)) isHidden = true;
            if (overwrite.deny.has(PermissionFlagsBits.Stream)) isStreamAllowed = false;
        }
    }

    const eSettings = getMonoEmoji('settings') || getMonoEmoji('gear');
    const eUser = getMonoEmoji('user');
    const eLock = isLocked ? (getMonoEmoji('lock_keyhole') || getMonoEmoji('status')) : (getMonoEmoji('unlock_keyhole') || getMonoEmoji('status'));
    const eEye = isHidden ? (getMonoEmoji('eye_off') || getMonoEmoji('status')) : (getMonoEmoji('eye') || getMonoEmoji('status'));
    const eVideo = getMonoEmoji('video') || getMonoEmoji('status');

    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eSettings} Özel Oda Kontrol Paneli\nOdanızı yönetmek ve özelleştirmek için aşağıdaki butonları kullanabilirsiniz.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Body Info
    const bodyText = [
        `» ${eUser} **Oda Sahibi:** <@${owner.id}>`,
        `» ${eLock} **Kilit Durumu:** **${isLocked ? 'Kilitli' : 'Açık'}**`,
        `» ${eEye} **Görünürlük:** **${isHidden ? 'Gizli' : 'Görünür'}**`,
        `» ${eVideo} **Yayın / Kamera:** **${isStreamAllowed ? 'Herkes Açabilir' : 'Yalnızca Sahip'}**`
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(bodyText)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Footer
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${getMonoEmoji('info')} Odanızda kimse kalmadığında oda otomatik olarak silinir.`)
    );

    // Satır 1: Kilit, Gizle, İsim, Limit
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(isLocked ? 'room_unlock' : 'room_lock')
            .setLabel(isLocked ? 'Kilidi Aç' : 'Kilitle')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(isHidden ? 'room_show' : 'room_hide')
            .setLabel(isHidden ? 'Göster' : 'Gizle')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('room_rename_btn')
            .setLabel('Oda Adı')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('room_limit_btn')
            .setLabel('Limit')
            .setStyle(ButtonStyle.Secondary)
    );

    if (isLocked) {
        if (MONO_EMOJIS.unlock_keyhole) row1.components[0].setEmoji(MONO_EMOJIS.unlock_keyhole);
    } else {
        if (MONO_EMOJIS.lock_keyhole) row1.components[0].setEmoji(MONO_EMOJIS.lock_keyhole);
    }
    if (isHidden) {
        if (MONO_EMOJIS.eye) row1.components[1].setEmoji(MONO_EMOJIS.eye);
    } else {
        if (MONO_EMOJIS.eye_off) row1.components[1].setEmoji(MONO_EMOJIS.eye_off);
    }
    if (MONO_EMOJIS.edit_2 || MONO_EMOJIS.settings) row1.components[2].setEmoji(MONO_EMOJIS.edit_2 || MONO_EMOJIS.settings);
    if (MONO_EMOJIS.users) row1.components[3].setEmoji(MONO_EMOJIS.users);

    // Satır 2: Üyeler, Beyaz Liste, Yayın, Kapat
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('room_manage_users_btn')
            .setLabel('Üye İzinleri')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('room_whitelist_btn')
            .setLabel('Beyaz Liste')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(isStreamAllowed ? 'room_stream_disable' : 'room_stream_enable')
            .setLabel('Yayın İzni')
            .setStyle(isStreamAllowed ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('room_delete')
            .setLabel('Odayı Kapat')
            .setStyle(ButtonStyle.Danger)
    );

    if (MONO_EMOJIS.user_round_plus || MONO_EMOJIS.user) row2.components[0].setEmoji(MONO_EMOJIS.user_round_plus || MONO_EMOJIS.user);
    if (MONO_EMOJIS.shield_check || MONO_EMOJIS.shield) row2.components[1].setEmoji(MONO_EMOJIS.shield_check || MONO_EMOJIS.shield);
    if (MONO_EMOJIS.video) row2.components[2].setEmoji(MONO_EMOJIS.video);
    if (MONO_EMOJIS.delete || MONO_EMOJIS.cross) row2.components[3].setEmoji(MONO_EMOJIS.delete || MONO_EMOJIS.cross);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, row1, row2]
    };
}

module.exports = { createRoomPanel };
