const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { formatDuration } = require('../../utils/musicManager');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('like')
        .setDescription('Kişisel favori müzik işlemlerini yönetir.')
        .addSubcommand(sub => 
            sub.setName('ekle')
                .setDescription('O an çalan şarkıyı favori kütüphanene ekler.')
        )
        .addSubcommand(sub => 
            sub.setName('liste')
                .setDescription('Beğendiğin favori şarkılar listesini görüntüler.')
        )
        .addSubcommand(sub => 
            sub.setName('çal')
                .setDescription('Favori şarkı listeni doğrudan ses kanalında başlatır.')
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const player = client.manager?.players.get(interaction.guildId);

        if (sub === 'ekle') {
            if (!player || !player.queue.current) {
                const err = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                    'Favorilere eklemek için şu an bir şarkı çalıyor olmalıdır.',
                    '#ED4245'
                );
                return await interaction.editReply(err);
            }

            const track = player.queue.current;
            const added = await db.addLikedSong(
                userId,
                track.title,
                track.author,
                track.uri,
                track.thumbnail,
                track.length
            );

            const payload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.heart || '1530917536806469783'}> ${added ? 'Favorilere Eklendi' : 'Zaten Favorilerinde'}`,
                added 
                    ? `[${track.title}](${track.uri}) başarıyla favori şarkılarına eklendi!`
                    : `**${track.title}** zaten favori kütüphanende kayıtlı.`,
                added ? '#57F287' : '#FEE75C'
            );
            return await interaction.editReply(payload);
        }

        if (sub === 'liste') {
            const likedList = await db.getLikedSongs(userId);
            if (!likedList.length) {
                const empty = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.heart || '1530917536806469783'}> Favori Şarkın Yok`,
                    'Henüz favorilerine hiçbir şarkı eklemedin. Çalan bir şarkıyı favorilere eklemek için `/like ekle` komutunu kullanabilirsin!',
                    '#2B2D31'
                );
                return await interaction.editReply(empty);
            }

            const listText = likedList.slice(0, 15).map((s, idx) => {
                return `\`${idx + 1}.\` [${s.track_title}](${s.track_url}) — \`${formatDuration(s.duration)}\``;
            }).join('\n');

            const payload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.heart || '1530917536806469783'}> Favori Şarkıların (Toplam: ${likedList.length})`,
                listText + (likedList.length > 15 ? `\n\n*... ve ${likedList.length - 15} şarkı daha.*` : ''),
                '#EB459E'
            );
            return await interaction.editReply(payload);
        }

        if (sub === 'çal') {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                const err = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Ses Kanalında Değilsiniz`,
                    'Favori şarkılarını çalmak için önce bir ses kanalına katılmalısın.',
                    '#ED4245'
                );
                return await interaction.editReply(err);
            }

            const likedList = await db.getLikedSongs(userId);
            if (!likedList.length) {
                const empty = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.heart || '1530917536806469783'}> Favori Şarkın Yok`,
                    'Favori listen boş olduğu için çalınamadı.',
                    '#2B2D31'
                );
                return await interaction.editReply(empty);
            }

            let activePlayer = player;
            if (!activePlayer) {
                activePlayer = await client.manager.createPlayer({
                    guildId: interaction.guildId,
                    textId: interaction.channelId,
                    voiceId: voiceChannel.id,
                    deaf: true
                });
            }

            let addedCount = 0;
            for (const song of likedList) {
                const res = await client.manager.search(song.track_url, { requester: interaction.user }).catch(() => null);
                if (res && res.tracks.length) {
                    activePlayer.queue.add(res.tracks[0]);
                    addedCount++;
                }
            }

            if (!activePlayer.playing && !activePlayer.paused) {
                activePlayer.play();
            }

            const payload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.heart || '1530917536806469783'}> Favori Şarkıların Çalınıyor`,
                `Favori listenden **${addedCount}** şarkı sıraya eklendi ve çalmaya başladı!`,
                '#57F287'
            );
            return await interaction.editReply(payload);
        }
    }
};
