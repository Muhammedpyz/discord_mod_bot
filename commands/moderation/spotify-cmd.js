const { SlashCommandBuilder } = require('discord.js');
const { buildModBResponse, createContainerMessage, EMOJIS, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spotify')
        .setDescription('Kullanıcının dinlediği Spotify şarkısını gösterir.')
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
                    `${EMOJIS.spotify} Spotify Durumu`,
                    `Bu kullanıcı şu an Spotify dinlemiyor veya çevrimdışı.`,
                    '#2B2D31'
                );
                return await interaction.editReply(notFoundPayload);
            }

            const spotifyActivity = member.presence.activities?.find(a => a.name === 'Spotify' && a.type === 2);

            if (!spotifyActivity) {
                const notListeningPayload = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.spotify}> Spotify Durumu`,
                    `Bu kullanıcı şu an Spotify dinlemiyor.`,
                    '#2B2D31'
                );
                return await interaction.editReply(notListeningPayload);
            }

            const songName = spotifyActivity.details;
            const artist = spotifyActivity.state;
            const album = spotifyActivity.assets?.largeText;
            const albumArt = spotifyActivity.assets?.largeImageURL();
            const trackId = spotifyActivity.syncId;

            // Zaman hesaplama ve Bar
            let barText = '';
            if (spotifyActivity.timestamps && spotifyActivity.timestamps.start && spotifyActivity.timestamps.end) {
                const start = spotifyActivity.timestamps.start.getTime();
                const end = spotifyActivity.timestamps.end.getTime();
                const current = Date.now();
                
                const totalSec = Math.max(1, Math.floor((end - start) / 1000));
                const currentSec = Math.min(totalSec, Math.max(0, Math.floor((current - start) / 1000)));
                
                const formatTime = (sec) => {
                    const m = Math.floor(sec / 60);
                    const s = Math.floor(sec % 60).toString().padStart(2, '0');
                    return `${m}:${s}`;
                };

                const progress = currentSec / totalSec;
                const length = 15;
                const filledBlocks = Math.round(progress * length);
                const emptyBlocks = length - filledBlocks;
                
                const filled = '━'.repeat(Math.max(0, filledBlocks - 1));
                const empty = '━'.repeat(emptyBlocks);
                
                const bar = `${filled}🔘${empty}`;
                barText = `\n\n\`${formatTime(currentSec)}\` ${bar} \`${formatTime(totalSec)}\``;
            }

            const textLines = [
                `**Şarkı:** ${songName}`,
                `**Sanatçı:** ${artist}`,
                `**Albüm:** ${album}${barText}`
            ];

            const actionRows = [];
            if (trackId) {
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                actionRows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Şarkıyı Aç')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://open.spotify.com/track/${trackId}`)
                        .setEmoji(MONO_EMOJIS.spotify)
                ));
            }

            const payload = buildModBResponse({
                title: `<:mono:${MONO_EMOJIS.spotify}> Spotify - ${targetUser.username}`,
                textLines: textLines,
                images: albumArt ? [albumArt] : [],
                actionRows: actionRows
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Error in spotify command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
