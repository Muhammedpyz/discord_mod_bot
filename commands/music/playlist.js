const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { getUserPlaylists, getUserPlaylist, saveUserPlaylist, deleteUserPlaylist } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Kişisel müzik çalma listesi yönetimi.')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Yeni bir özel çalma listesi oluşturur.')
                .addStringOption(opt => opt.setName('isim').setDescription('Liste adı').setRequired(true).setMaxLength(32))
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Çalma listenize yeni bir şarkı ekler.')
                .addStringOption(opt => opt.setName('isim').setDescription('Liste adı').setRequired(true))
                .addStringOption(opt => opt.setName('sarki').setDescription('Şarkı adı veya URL (boş bırakılırsa o an çalan parça eklenir)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Kaydettiğiniz bir çalma listesini oynatır.')
                .addStringOption(opt => opt.setName('isim').setDescription('Liste adı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Oluşturduğunuz tüm çalma listelerini görüntüler.')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Bir çalma listesini siler.')
                .addStringOption(opt => opt.setName('isim').setDescription('Silinecek liste adı').setRequired(true))
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'create') {
            const name = interaction.options.getString('isim').trim();
            const existing = await getUserPlaylist(userId, name);
            if (existing) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Liste Zaten Var`,
                    `\`${name}\` adında bir çalma listeniz zaten mevcut.`,
                    '#ED4245'
                ));
            }

            const ok = await saveUserPlaylist(userId, name, []);
            if (ok) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Çalma Listesi Oluşturuldu`,
                    `\`${name}\` listesi başarıyla oluşturuldu!\n\n-# Şarkı eklemek için: \`/playlist add isim:${name} sarki:<sarki_adi>\``,
                    '#57F287'
                ));
            } else {
                return await interaction.editReply(createContainerMessage(
                    'Hata',
                    'Liste oluşturulurken veritabanı hatası oluştu.',
                    '#ED4245'
                ));
            }
        }

        else if (sub === 'add') {
            const name = interaction.options.getString('isim').trim();
            const songInput = interaction.options.getString('sarki');
            const playlist = await getUserPlaylist(userId, name);

            if (!playlist) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Liste Bulunamadı`,
                    `\`${name}\` adında bir çalma listeniz bulunamadı. Önce \`/playlist create\` ile oluşturun.`,
                    '#ED4245'
                ));
            }

            const addedTracks = [];
            if (songInput) {
                const searchRes = await client.manager.search(songInput, { requester: interaction.user });
                if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                    if (searchRes.loadType === 'playlist' || searchRes.loadType === 'PLAYLIST_LOADED' || (searchRes.tracks.length > 1 && (songInput.includes('playlist') || songInput.includes('album')))) {
                        const slice = searchRes.tracks.slice(0, 50);
                        for (const t of slice) {
                            addedTracks.push({ title: t.title, uri: t.uri, author: t.author, length: t.length });
                        }
                    } else {
                        const t = searchRes.tracks[0];
                        addedTracks.push({ title: t.title, uri: t.uri, author: t.author, length: t.length });
                    }
                } else {
                    return await interaction.editReply(createContainerMessage(
                        `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Şarkı Bulunamadı`,
                        `\`${songInput}\` aramasına uygun parça bulunamadı.`,
                        '#ED4245'
                    ));
                }
            } else {
                const player = client.manager?.players.get(interaction.guildId);
                if (player && player.queue.current) {
                    const t = player.queue.current;
                    addedTracks.push({ title: t.title, uri: t.uri, author: t.author, length: t.length });
                } else {
                    return await interaction.editReply(createContainerMessage(
                        `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Şarkı Belirtilmedi`,
                        'Lütfen bir şarkı adı yazın veya ses kanalında çalan bir şarkı varken komutu kullanın.',
                        '#ED4245'
                    ));
                }
            }

            playlist.tracks.push(...addedTracks);
            await saveUserPlaylist(userId, name, playlist.tracks);

            if (addedTracks.length > 1) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Şarkılar Listeye Eklendi`,
                    `**${addedTracks.length} adet parça** başarıyla \`${name}\` listesine toplu olarak kaydedildi.\n\n-# Toplam Şarkı: **${playlist.tracks.length}**`,
                    '#57F287'
                ));
            } else {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Şarkı Listeye Eklendi`,
                    `**[${addedTracks[0].title}](${addedTracks[0].uri})** parçası \`${name}\` listesine kaydedildi.\n\n-# Toplam Şarkı: **${playlist.tracks.length}**`,
                    '#57F287'
                ));
            }
        }

        else if (sub === 'list') {
            const playlists = await getUserPlaylists(userId);
            if (!playlists.length) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1537768164640815165'}> Çalma Listeniz Yok`,
                    'Henüz kayıtlı bir çalma listeniz bulunmuyor.\n\n-# Yeni bir liste oluşturmak için: \`/playlist create isim:<liste_adi>\`',
                    '#5865F2'
                ));
            }

            const listText = playlists.map((p, idx) => {
                return `**${idx + 1}. ${p.name}** › \`${p.tracks.length} şarkı\``;
            }).join('\n');

            const payload = buildModBResponse({
                title: 'Kişisel Çalma Listeleriniz',
                textLines: [
                    'Kaydettiğiniz tüm çalma listeleri:',
                    '---SEPARATOR---',
                    listText,
                    '---SEPARATOR---',
                    '-# Oynatmak için: \`/playlist play isim:<liste_adi>\`'
                ]
            });
            return await interaction.editReply(payload);
        }

        else if (sub === 'play') {
            const name = interaction.options.getString('isim').trim();
            const playlist = await getUserPlaylist(userId, name);

            if (!playlist || !playlist.tracks.length) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Boş Liste veya Bulunamadı`,
                    `\`${name}\` listesi bulunamadı veya listesinde hiç şarkı yok.`,
                    '#ED4245'
                ));
            }

            const memberVoice = interaction.member.voice.channel;
            if (!memberVoice) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Ses Kanalında Değilsiniz`,
                    'Çalma listesini başlatmak için bir ses kanalına katılmalısınız.',
                    '#ED4245'
                ));
            }

            let player = client.manager?.players.get(interaction.guildId);
            if (!player) {
                player = await client.manager.createPlayer({
                    guildId: interaction.guildId,
                    textId: interaction.channelId,
                    voiceId: memberVoice.id,
                    volume: 100,
                    deaf: true
                });
            }

            let addedCount = 0;
            for (const item of playlist.tracks) {
                const searchRes = await client.manager.search(item.uri || item.title, { requester: interaction.user });
                if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                    player.queue.add(searchRes.tracks[0]);
                    addedCount++;
                }
            }

            if (!player.playing && !player.paused) {
                await player.play();
            }

            return await interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.music_note || '1538517605902716960'}> Çalma Listesi Başlatıldı`,
                `\`${name}\` listesinden **${addedCount} şarkı** sıraya eklendi ve çalınmaya başlandı.`,
                '#57F287'
            ));
        }

        else if (sub === 'delete') {
            const name = interaction.options.getString('isim').trim();
            const ok = await deleteUserPlaylist(userId, name);

            if (ok) {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Liste Silindi`,
                    `\`${name}\` çalma listesi başarıyla silindi.`,
                    '#57F287'
                ));
            } else {
                return await interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Bulunamadı`,
                    `\`${name}\` adında bir liste bulunamadı.`,
                    '#ED4245'
                ));
            }
        }
    }
};
