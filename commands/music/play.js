const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Spotify, YouTube Music, SoundCloud veya link üzerinden müzik çalar.')
        .addStringOption(option => 
            option.setName('sarki')
                .setDescription('Şarkı adı, sanatçı veya bağlantı (URL)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();

        const { member, guild, channel } = interaction;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            const errPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Ses Kanalında Değilsiniz`,
                'Müzik çalabilmek için lütfen öncelikle bir ses kanalına katılın.',
                '#ED4245'
            );
            return await interaction.editReply(errPayload);
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            const errPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Yetki Yetersiz`,
                'Ses kanalına katılmak veya konuşmak için gerekli yetkilere sahip değilim.',
                '#ED4245'
            );
            return await interaction.editReply(errPayload);
        }

        const query = interaction.options.getString('sarki');

        let player = client.manager.players.get(guild.id);
        if (!player) {
            player = await client.manager.createPlayer({
                guildId: guild.id,
                textId: voiceChannel.id, // Doğrudan Ses Kanalının Kendi Metin Sohbeti!
                voiceId: voiceChannel.id,
                deaf: true
            });
        } else {
            // Eğer player varsa textId'yi güncel ses kanalına eşitle
            player.setTextChannel(voiceChannel.id);
        }

        const result = await client.manager.search(query, { requester: member.user });

        if (!result || !result.tracks.length) {
            const notFoundPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Şarkı Bulunamadı`,
                `**"${query}"** araması için herhangi bir parça bulunamadı.`,
                '#ED4245'
            );
            return await interaction.editReply(notFoundPayload);
        }

        if (result.type === 'PLAYLIST') {
            for (const track of result.tracks) {
                player.queue.add(track);
            }
            if (!player.playing && !player.paused) player.play();

            const playlistPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Çalma Listesi Eklendi`,
                `**${result.playlistName || 'Çalma Listesi'}** listesinden **${result.tracks.length}** şarkı sıraya eklendi!`,
                '#57F287'
            );
            return await interaction.editReply(playlistPayload);
        }

        const track = result.tracks[0];
        player.queue.add(track);

        if (!player.playing && !player.paused) {
            player.play();
            const startedPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Şarkı Başlatılıyor`,
                `[${track.title}](${track.uri}) çalmaya başlıyor...`,
                '#57F287'
            );
            return await interaction.editReply(startedPayload);
        } else {
            const queuedPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Sıraya Eklendi`,
                `[${track.title}](${track.uri})\n\n<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Sanatçı:** ${track.author}\n<:mono:${MONO_EMOJIS.time || '1530917536806469783'}> **Sıra Konumu:** #${player.queue.length}`,
                '#5865F2'
            );
            return await interaction.editReply(queuedPayload);
        }
    }
};
