const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const { buildNowPlayingPayload, APP_EMOJIS } = require('./musicManager');
const db = require('../db');

const cooldowns = new Map();

function isAuthorized(member, track) {
    if (!track) return true;
    const requesterId = track.requester?.id || track.requester;
    if (member.id === requesterId) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild) || 
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }
    // DJ Rolü kontrolü
    if (member.roles.cache.some(r => r.name.toLowerCase() === 'dj' || r.name.toLowerCase().includes('müzik'))) {
        return true;
    }
    return false;
}

async function handleMusicButton(interaction) {
    if (!interaction.customId.startsWith('music_')) return false;

    const { client, guild, member, user } = interaction;
    const player = client.manager?.players.get(guild.id);

    // 1. Spam & Cooldown Koruması (1.5 Saniye)
    const now = Date.now();
    const userCooldown = cooldowns.get(user.id) || 0;
    if (now - userCooldown < 1500) {
        await interaction.reply({
            content: `<:white_info:${APP_EMOJIS.white_info}> Lütfen butonlara bu kadar hızlı basmayın, biraz bekleyin.`,
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
        return true;
    }
    cooldowns.set(user.id, now);

    // 2. Aktif Müzik Kontrolü
    if (!player || (!player.queue.current && interaction.customId !== 'music_stop')) {
        await interaction.reply({
            content: `<:white_cross:${APP_EMOJIS.white_cross}> Şu an çalan bir müzik bulunmuyor.`,
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
        return true;
    }

    // 3. Ses Kanalı Kontrolü (Yalnızca botla aynı ses odasındakiler)
    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.id !== player.voiceId) {
        await interaction.reply({
            content: `<:white_cross:${APP_EMOJIS.white_cross}> Bu butonları kullanabilmek için bot ile **aynı ses kanalında** olmalısınız!`,
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
        return true;
    }

    const currentTrack = player.queue.current;
    const isOwnerOrStaff = isAuthorized(member, currentTrack);

    // Bot hariç odadaki dinleyici sayısı
    const listenersCount = voiceChannel.members.filter(m => !m.user.bot).size;

    switch (interaction.customId) {
        case 'music_pause_resume': {
            if (!isOwnerOrStaff && listenersCount > 2) {
                await interaction.reply({
                    content: `<:white_cross:${APP_EMOJIS.white_cross}> Müziği duraklatmak/devam ettirmek için şarkıyı açan kişi (<@${currentTrack.requester?.id || currentTrack.requester}>) veya **DJ / Yetkili** olmalısınız.`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return true;
            }

            await interaction.deferUpdate().catch(() => {});
            player.pause(!player.paused);
            const payload = buildNowPlayingPayload(player, player.queue.current);
            await interaction.message.edit(payload).catch(() => {});
            break;
        }

        case 'music_skip': {
            if (player.queue.length === 0) {
                await interaction.reply({
                    content: `<:white_info:${APP_EMOJIS.white_info}> Sırada geçilecek başka bir şarkı bulunmuyor! Müziği sonlandırmak isterseniz **Durdur & Çık** butonunu kullanabilirsiniz.`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return true;
            }

            if (isOwnerOrStaff || listenersCount <= 2) {
                await interaction.deferUpdate().catch(() => {});
                player.skipVotes?.clear();
                player.skip();
                return true;
            }

            if (!player.skipVotes) player.skipVotes = new Set();

            if (player.skipVotes.has(user.id)) {
                await interaction.reply({
                    content: `<:white_info:${APP_EMOJIS.white_info}> Zaten bu şarkıyı geçmek için oy kullandınız!`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return true;
            }

            player.skipVotes.add(user.id);
            const requiredVotes = Math.ceil(listenersCount / 2);
            const currentVotes = player.skipVotes.size;

            if (currentVotes >= requiredVotes) {
                await interaction.deferUpdate().catch(() => {});
                player.skipVotes.clear();
                player.skip();
            } else {
                await interaction.reply({
                    content: `<:white_tick:${APP_EMOJIS.white_tick}> Şarkıyı geçmek için oy verdiniz! (\`${currentVotes}/${requiredVotes}\` oy - Geçmek için ${requiredVotes - currentVotes} oy daha gerekli).`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
            break;
        }

        case 'music_loop': {
            if (!isOwnerOrStaff && listenersCount > 2) {
                await interaction.reply({
                    content: `<:white_cross:${APP_EMOJIS.white_cross}> Döngü modunu değiştirmek için şarkıyı açan kişi (<@${currentTrack.requester?.id || currentTrack.requester}>) veya **DJ / Yetkili** olmalısınız.`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return true;
            }

            await interaction.deferUpdate().catch(() => {});
            if (player.loop === 'none') {
                player.setLoop('track');
            } else if (player.loop === 'track') {
                player.setLoop('queue');
            } else {
                player.setLoop('none');
            }
            const payload = buildNowPlayingPayload(player, player.queue.current);
            await interaction.message.edit(payload).catch(() => {});
            break;
        }

        case 'music_like': {
            const track = player.queue.current;
            if (track) {
                const added = await db.addLikedSong(
                    user.id,
                    track.title,
                    track.author,
                    track.uri,
                    track.thumbnail,
                    track.length
                );
                await interaction.reply({
                    content: added 
                        ? `<:heart4:${APP_EMOJIS.heart4}> **${track.title}** favori şarkılarına eklendi!`
                        : `<:white_tick:${APP_EMOJIS.white_tick}> Bu şarkı zaten favorilerinde bulunuyor.`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
            break;
        }

        case 'music_stop': {
            if (!isOwnerOrStaff && listenersCount > 1) {
                await interaction.reply({
                    content: `<:white_cross:${APP_EMOJIS.white_cross}> Müziği tamamen durdurup botu kanaldan çıkarmak için şarkıyı açan kişi (<@${currentTrack?.requester?.id || currentTrack?.requester}>) veya **Yetkili** olmalısınız.`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return true;
            }

            await interaction.deferUpdate().catch(() => {});
            player.destroy();
            const stopPayload = createContainerMessage(
                `<:white_musicnote:${APP_EMOJIS.white_musicnote}> Müzik Durduruldu`,
                `<@${user.id}> tarafından müzik tamamen durduruldu ve ses kanalından ayrıldım.`,
                '#2B2D31'
            );
            await interaction.message.edit(stopPayload).catch(() => {});
            break;
        }
    }

    return true;
}

module.exports = {
    handleMusicButton
};
