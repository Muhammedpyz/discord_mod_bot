const { SlashCommandBuilder } = require('discord.js');
const { buildModBResponse, createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');

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
                    `${EMOJIS.spotify} Spotify Durumu`,
                    `Bu kullanıcı şu an Spotify dinlemiyor.`,
                    '#2B2D31'
                );
                return await interaction.editReply(notListeningPayload);
            }

            const songName = spotifyActivity.details;
            const artist = spotifyActivity.state;
            const album = spotifyActivity.assets?.largeText;
            const albumArt = spotifyActivity.assets?.largeImageURL();

            const textLines = [
                `**Şarkı:** ${songName}`,
                `**Sanatçı:** ${artist}`,
                `**Albüm:** ${album}`
            ];

            const payload = buildModBResponse({
                title: `${EMOJIS.spotify} Spotify - ${targetUser.username}`,
                textLines: textLines,
                images: albumArt ? [albumArt] : []
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Error in spotify command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
