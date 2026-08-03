const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createV2Container } = require('./v2Builder');

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

    const { MONO_EMOJIS } = require('./uiBuilder');

    // Satır 1: 4 Adet Kısa Buton (Mobil ekranda kayma yapmaz, yan yana sığar)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(isLocked ? 'room_unlock' : 'room_lock')
            .setLabel(isLocked ? 'Kilidi Aç' : 'Kilitle')
            .setEmoji(isLocked ? MONO_EMOJIS.unlock : MONO_EMOJIS.lock)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(isHidden ? 'room_show' : 'room_hide')
            .setLabel(isHidden ? 'Göster' : 'Gizle')
            .setEmoji(isHidden ? MONO_EMOJIS.check : MONO_EMOJIS.cross)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('room_rename_btn')
            .setLabel('Ad')
            .setEmoji(MONO_EMOJIS.settings)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('room_limit_btn')
            .setLabel('Limit')
            .setEmoji(MONO_EMOJIS.add)
            .setStyle(ButtonStyle.Secondary)
    );

    // Satır 2: 4 Adet Yönetim & Kapatma Butonu
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('room_manage_users_btn')
            .setLabel('Üyeler')
            .setEmoji(MONO_EMOJIS.invite)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('room_whitelist_btn')
            .setLabel('B. Liste')
            .setEmoji(MONO_EMOJIS.shield)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(isStreamAllowed ? 'room_stream_disable' : 'room_stream_enable')
            .setLabel('Yayın')
            .setEmoji(MONO_EMOJIS.twitch)
            .setStyle(isStreamAllowed ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('room_delete')
            .setLabel('Kapat')
            .setEmoji(MONO_EMOJIS.delete)
            .setStyle(ButtonStyle.Danger)
    );

    const desc = `**Oda Sahibi:** <@${owner.id}>\n**Kanal ID:** \`${channelId}\`\n\n**Oda Durumu:**\n- Kilit Durumu: **${isLocked ? 'Kilitli' : 'Acik'}**\n- Gorunurluk: **${isHidden ? 'Gizli' : 'Gorunur'}**\n- Yayin/Kamera: **${isStreamAllowed ? 'Herkes Acabilir' : 'Kapali'}**\n\nAsagidaki butonlari kullanarak özel odanizin durumunu yonetebilirsiniz.`;

    return createV2Container({
        title: 'Özel Oda Kontrol Paneli',
        description: desc,
        actionRows: [row1, row2],
        showBrand: false,
        footer: 'turklion.net - Özel Oda Yönetim Sistemi'
    });
}

module.exports = { createRoomPanel };
