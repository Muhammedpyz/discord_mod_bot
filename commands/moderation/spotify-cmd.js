const { 
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, 
    SectionBuilder, ThumbnailBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, MessageFlags 
} = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function buildProgressBar(currentSec, totalSec) {
    const rawProgress = currentSec / totalSec;
    const progress = Math.min(1, Math.max(0, rawProgress));
    let percentage = Math.min(100, Math.round(progress * 100));
    
    // Son 1 saniyeye girildiyse tam %100 yap
    if (totalSec - currentSec <= 1 || progress >= 0.98) {
        percentage = 100;
    }

    const totalBlocks = 12;
    let filledCount = Math.round((percentage / 100) * totalBlocks);
    if (percentage === 100) {
        filledCount = totalBlocks;
    }
    filledCount = Math.min(totalBlocks, Math.max(0, filledCount));
    const emptyCount = Math.max(0, totalBlocks - filledCount);
    
    const filled = '▰'.repeat(filledCount);
    const empty = '▱'.repeat(emptyCount);
    
    return `<:mono:${MONO_EMOJIS.disc_3 || '1537767766566768681'}> \`${formatTime(currentSec)}\` ${filled}${empty} \`${formatTime(totalSec)}\` (\`%${percentage}\`)`;
}

function buildSpotifyPayload(targetUser, spotifyActivity, showBar = true) {
    const songName = spotifyActivity?.details || 'Bilinmiyor';
    const artist = spotifyActivity?.state || 'Bilinmiyor';
    const album = spotifyActivity?.assets?.largeText || 'Bilinmiyor';
    const albumArt = spotifyActivity?.assets?.largeImageURL ? spotifyActivity.assets.largeImageURL() : null;
    const trackId = spotifyActivity?.syncId;

    let barText = '';
    if (showBar && spotifyActivity?.timestamps?.start && spotifyActivity?.timestamps?.end) {
        const start = spotifyActivity.timestamps.start.getTime();
        const end = spotifyActivity.timestamps.end.getTime();
        const current = Date.now();
        
        const totalSec = Math.max(1, Math.floor((end - start) / 1000));
        const currentSec = Math.min(totalSec, Math.max(0, Math.floor((current - start) / 1000)));
        barText = `\n\n${buildProgressBar(currentSec, totalSec)}`;
    }

    const contentLines = [
        `### <:mono:${MONO_EMOJIS.spotify || '1530917513851048119'}> Spotify — ${targetUser.username || targetUser.tag || 'Kullanıcı'}`,
        '',
        `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> **Şarkı:** ${songName}`,
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Sanatçı:** ${artist}`,
        `<:mono:${MONO_EMOJIS.disc_2 || '1537767790394482688'}> **Albüm:** ${album}${barText}`
    ];

    // 1. Ana Bilgi Kartı (Sağda Thumbnail)
    const mainContainer = new ContainerBuilder();
    const section = new SectionBuilder();
    section.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(contentLines.join('\n'))
    );

    if (albumArt) {
        section.setThumbnailAccessory(new ThumbnailBuilder({
            media: { url: albumArt },
            description: `${songName} - ${artist}`
        }));
    }

    mainContainer.addSectionComponents(section);
    const components = [mainContainer];

    // 2. Ayrı Bağımsız İkinci Container (Geniş & Ortalı Buton)
    if (trackId) {
        const buttonContainer = new ContainerBuilder();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Şarkıyı Aç')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://open.spotify.com/track/${trackId}`)
                .setEmoji(MONO_EMOJIS.spotify || '1530917513851048119')
        );
        buttonContainer.addActionRowComponents(row);
        components.push(buttonContainer);
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components: components
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spotify')
        .setDescription('Kullanıcının dinlediği Spotify şarkısını ve canlı çalma durumunu gösterir.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Spotify durumunu görmek istediğiniz kullanıcı')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!member || !member.presence) {
                const notFoundPayload = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.spotify || '1530917513851048119'}> Spotify Durumu`,
                    `Bu kullanıcı şu an Spotify dinlemiyor veya çevrimdışı.`,
                    '#2B2D31'
                );
                return await interaction.editReply(notFoundPayload);
            }

            const spotifyActivity = member.presence.activities?.find(a => a.name === 'Spotify' && a.type === 2);

            if (!spotifyActivity) {
                const notListeningPayload = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.spotify || '1530917513851048119'}> Spotify Durumu`,
                    `Bu kullanıcı şu an Spotify dinlemiyor.`,
                    '#2B2D31'
                );
                return await interaction.editReply(notListeningPayload);
            }

            // İlk mesajı gönder
            let currentTrackId = spotifyActivity.syncId;
            const initialPayload = buildSpotifyPayload(targetUser, spotifyActivity, true);
            await interaction.editReply(initialPayload);

            // Canlı Takip Döngüsü (Her 2 saniyede bir)
            let tickCount = 0;
            const maxTicks = 90; // ~3 dakika canlı izleme

            const interval = setInterval(async () => {
                tickCount++;
                if (tickCount > maxTicks) {
                    clearInterval(interval);
                    // Maksimum izleme süresi dolunca barı kaldır
                    const finalPayload = buildSpotifyPayload(targetUser, spotifyActivity, false);
                    await interaction.editReply(finalPayload).catch(() => {});
                    return;
                }

                try {
                    const freshMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                    if (!freshMember || !freshMember.presence) {
                        // Kullanıcı çevrimdışı oldu -> Barı kaldır
                        clearInterval(interval);
                        const finalPayload = buildSpotifyPayload(targetUser, spotifyActivity, false);
                        await interaction.editReply(finalPayload).catch(() => {});
                        return;
                    }

                    const currentActivity = freshMember.presence.activities?.find(a => a.name === 'Spotify' && a.type === 2);
                    
                    // 1. Durum: Kullanıcı Spotify'ı Durdurdu / Kapattı
                    if (!currentActivity) {
                        clearInterval(interval);
                        const finalPayload = buildSpotifyPayload(targetUser, spotifyActivity, false);
                        await interaction.editReply(finalPayload).catch(() => {});
                        return;
                    }

                    // 2. Durum: Kullanıcı Başka Bir Şarkıya Geçti
                    if (currentActivity.syncId !== currentTrackId) {
                        currentTrackId = currentActivity.syncId; // Yeni şarkıya sorunsuz geçiş yap
                    }

                    // 3. Durum: Şarkı Süresi Doldu (Bitti)
                    const now = Date.now();
                    const endTime = currentActivity.timestamps?.end ? currentActivity.timestamps.end.getTime() : 0;
                    if (endTime && now >= endTime) {
                        clearInterval(interval);
                        const finalPayload = buildSpotifyPayload(targetUser, currentActivity, false);
                        await interaction.editReply(finalPayload).catch(() => {});
                        return;
                    }

                    // 4. Durum: Canlı Akış (Kullanıcı ileri/geri sarsa bile timestamps.start'tan anında yakalar)
                    const updatedPayload = buildSpotifyPayload(targetUser, currentActivity, true);
                    await interaction.editReply(updatedPayload).catch(() => {
                        clearInterval(interval);
                    });
                } catch (e) {
                    clearInterval(interval);
                }
            }, 2000);

        } catch (error) {
            console.error('Error in spotify command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
