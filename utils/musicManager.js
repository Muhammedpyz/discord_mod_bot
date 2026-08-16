const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const Spotify = require('kazagumo-spotify');
const { 
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, 
    ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, MessageFlags 
} = require('discord.js');
const { MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');
const db = require('../db');

// Developer Portal Bot App Emojileri
const APP_EMOJIS = {
    play: '1538519714924462111',
    pause: '1538519707110612992',
    stop: '1538519763850887168',
    skip_next: '1538519742397284525',
    skip_prev: '1538519753583362178',
    repeat: '1538519722549579847',
    shuffle: '1538519733136130120',
    music_note: '1538517605902716960',
    white_musicnote: '1538517890737774622',
    heart4: '1538517512340119664',
    white_cross: '1538517856797331528',
    white_tick: '1538517908815347762',
    white_info: '1538517864640815165',
    bar_l_filled: '1538524468710866944',
    bar_l_empty: '1538524459127017492',
    bar_m_filled: '1538524484041183313',
    bar_m_empty: '1538524476289843322',
    bar_r_filled: '1538524509349609492',
    bar_r_empty: '1538524497785651321'
};

function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}

function buildMusicProgressBar(currentMs, totalMs) {
    if (!totalMs || totalMs <= 0) return '';
    const progress = Math.min(1, Math.max(0, currentMs / totalMs));
    const percentage = Math.min(100, Math.round(progress * 100));
    
    // 10 Parçalı Kesintisiz Özel Emoji Çubuğu (1 Sol + 8 Orta + 1 Sağ)
    const totalSegments = 10;
    const filledCount = Math.round((percentage / 100) * totalSegments);
    
    // 1. Sol Uç
    const leftPiece = filledCount >= 1 
        ? `<:bar_l_filled:${APP_EMOJIS.bar_l_filled}>` 
        : `<:bar_l_empty:${APP_EMOJIS.bar_l_empty}>`;
    
    // 2. Orta Parçalar (8 Adet)
    let midPieces = '';
    for (let i = 2; i <= 9; i++) {
        if (filledCount >= i) {
            midPieces += `<:bar_m_filled:${APP_EMOJIS.bar_m_filled}>`;
        } else {
            midPieces += `<:bar_m_empty:${APP_EMOJIS.bar_m_empty}>`;
        }
    }
    
    // 3. Sağ Uç
    const rightPiece = filledCount >= 10 
        ? `<:bar_r_filled:${APP_EMOJIS.bar_r_filled}>` 
        : `<:bar_r_empty:${APP_EMOJIS.bar_r_empty}>`;
    
    const bar = `${leftPiece}${midPieces}${rightPiece}`;
    return `${bar}\n\`${formatDuration(currentMs)} / ${formatDuration(totalMs)}\` (\`%${percentage}\`)`;
}

function buildNowPlayingPayload(player, track) {
    const title = track?.title || 'Bilinmiyor';
    const author = track?.author || 'Bilinmiyor';
    const requester = track?.requester ? `<@${track.requester.id || track.requester}>` : 'Bilinmiyor';
    const uri = track?.uri || 'https://open.spotify.com';
    const thumbnail = track?.thumbnail || null;
    const durationStr = track?.isStream ? 'Canlı Yayın' : `${formatDuration(player.position || 0)} / ${formatDuration(track?.length)}`;

    const position = player.position || 0;
    const barText = !track?.isStream ? `\n\n${buildMusicProgressBar(position, track?.length)}` : '';

    const volumeVal = player.volume || 100;
    const filterVal = player.filterName || 'Normal';
    const loopVal = player.loop === 'track' ? 'Şarkı' : player.loop === 'queue' ? 'Sıra' : 'Kapalı';
    const rad247Val = player.is247 ? 'Aktif' : 'Deaktif';

    const contentLines = [
        `### <:music_note:${APP_EMOJIS.music_note}> Şimdi Çalıyor`,
        '',
        `<:white_musicnote:${APP_EMOJIS.white_musicnote}> **Şarkı:** [${title}](${uri})`,
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Sanatçı:** ${author}`,
        `<:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> **İsteyen:** ${requester}`,
        `<:white_info:${APP_EMOJIS.white_info}> **Süre:** \`${durationStr}\`${barText}`,
        '',
        `<:mono:${MONO_EMOJIS.speaker || '1537769826636927006'}> **Ses Seviyesi:** \`%${volumeVal}\``,
        `<:mono:${MONO_EMOJIS.sliders_horizontal || '1537769889840889956'}> **Ses Filtresi:** \`${filterVal}\``,
        `<:mono:${MONO_EMOJIS.infinity || '1537769920111190056'}> **Döngü Modu:** \`${loopVal}\``,
        `<:mono:${MONO_EMOJIS.antenna || '1537769784983162920'}> **7/24 Kesintisiz:** \`${rad247Val}\``
    ];

    // 1. Ana Bilgi Kartı
    const mainContainer = new ContainerBuilder();
    const section = new SectionBuilder();
    section.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(contentLines.join('\n'))
    );

    if (thumbnail) {
        section.setThumbnailAccessory(new ThumbnailBuilder({
            media: { url: thumbnail },
            description: `${title} - ${author}`
        }));
    }
    mainContainer.addSectionComponents(section);

    // 2. İnteraktif Buton Kartı (App Emojileri ile)
    const buttonContainer = new ContainerBuilder();
    const isPaused = player.paused;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_pause_resume')
            .setLabel(isPaused ? 'Devam Et' : 'Duraklat')
            .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(isPaused ? APP_EMOJIS.play : APP_EMOJIS.pause),
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setLabel('Geç')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(APP_EMOJIS.skip_next),
        new ButtonBuilder()
            .setCustomId('music_loop')
            .setLabel(player.loop === 'track' ? 'Şarkı Döngüsü' : player.loop === 'queue' ? 'Sıra Döngüsü' : 'Döngü')
            .setStyle(player.loop !== 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji(APP_EMOJIS.repeat),
        new ButtonBuilder()
            .setCustomId('music_like')
            .setLabel('Beğen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(APP_EMOJIS.heart4),
        new ButtonBuilder()
            .setCustomId('music_stop')
            .setLabel('Durdur & Çık')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(APP_EMOJIS.stop)
    );
    buttonContainer.addActionRowComponents(row);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [mainContainer, buttonContainer]
    };
}

function clearProgressUpdater(player) {
    if (player.progressInterval) {
        clearInterval(player.progressInterval);
        player.progressInterval = null;
    }
}

function startProgressUpdater(client, player) {
    clearProgressUpdater(player);

    player.progressInterval = setInterval(async () => {
        if (!player.playing || player.paused || !player.queue.current || !player.nowPlayingMessageId || !player.textId) {
            return;
        }

        const channel = client.channels.cache.get(player.textId);
        if (!channel) return;

        try {
            const payload = buildNowPlayingPayload(player, player.queue.current);
            await channel.messages.edit(player.nowPlayingMessageId, payload).catch(() => {});
        } catch (e) {}
    }, 4000);
}

function initMusicManager(client) {
    const nodes = [
        {
            name: "Groove-Main",
            url: "lavalinkv4.serenetia.com:443",
            auth: "https://seretia.link/discord",
            secure: true
        }
    ];

    const spotifyPlugin = new Spotify({
        clientId: "85aab1d51a174aad9eed6d7989f530e6",
        clientSecret: "b2ad05aa725e434c88776a1be8eab6c",
        playlistPageLimit: 2,
        albumPageLimit: 2,
        searchLimit: 10,
        searchMarket: 'TR'
    });

    const manager = new Kazagumo(
        {
            defaultSearchEngine: "ytmsearch",
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            },
            plugins: [spotifyPlugin]
        },
        new Connectors.DiscordJS(client),
        nodes,
        {
            moveOnDisconnect: true,
            resume: true,
            reconnectTries: 15,
            reconnectInterval: 10000,
            restTimeout: 60000
        }
    );

    manager.shoukaku.on('ready', (name) => {
        console.log(`[Müzik] Lavalink Düğümü Hazır: ${name}`);
    });

    manager.shoukaku.on('error', (name, error) => {
        console.warn(`[Müzik] Lavalink Hatası (${name}):`, error?.message || error);
    });

    manager.shoukaku.on('close', (name, code, reason) => {
        console.warn(`[Müzik] Lavalink Bağlantısı Kapandı (${name}): Kod ${code} - ${reason}`);
    });

    manager.shoukaku.on('disconnect', (name, count) => {
        console.warn(`[Müzik] Lavalink Bağlantısı Kesildi (${name}) - Kalan: ${count}`);
    });

    manager.on('playerCreate', (player) => {
        try {
            player.shoukaku.clearFilters();
            player.filterName = 'Normal';
        } catch (e) {}
    });

    manager.on('playerStart', async (player, track) => {
        try {
            player.shoukaku.clearFilters();
            player.filterName = player.filterName || 'Normal';
        } catch (e) {}

        if (player.skipVotes) player.skipVotes.clear();

        if (!player.textId) return;
        const channel = client.channels.cache.get(player.textId);
        if (!channel) return;

        const config = await db.getMusicConfig(player.guildId).catch(() => null);
        player.is247 = config ? !!config.is_247_enabled : false;

        if (player.nowPlayingMessageId) {
            try {
                const oldMsg = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
                if (oldMsg) {
                    await oldMsg.delete().catch(() => {});
                }
            } catch (e) {}
        }

        if (player.guildId && track.requester) {
            db.addMusicHistory(player.guildId, track.requester.id || track.requester, track.title, track.uri).catch(() => {});
        }

        try {
            const payload = buildNowPlayingPayload(player, track);
            const msg = await channel.send(payload).catch(() => null);
            if (msg) {
                player.nowPlayingMessageId = msg.id;
                startProgressUpdater(client, player);
            }
        } catch (e) {
            console.error('[Müzik] playerStart gönderme hatası:', e);
        }
    });

    manager.on('playerEmpty', async (player) => {
        clearProgressUpdater(player);

        if (!player.textId) return;
        const channel = client.channels.cache.get(player.textId);

        if (player.nowPlayingMessageId && channel) {
            try {
                const oldMsg = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
                if (oldMsg) {
                    const emptyPayload = createContainerMessage(
                        `<:music_note:${APP_EMOJIS.music_note}> Müzik Sona Erdi`,
                        'Sırada başka şarkı kalmadığı için müzik tamamlandı.',
                        '#2B2D31'
                    );
                    await oldMsg.edit(emptyPayload).catch(() => {});
                }
            } catch (e) {}
        }

        const config = await db.getMusicConfig(player.guildId).catch(() => null);
        if (config && config.is_247_enabled) {
            return;
        }

        setTimeout(async () => {
            if (player.queue.length === 0 && !player.queue.current) {
                player.destroy();
            }
        }, 30000);
    });

    manager.on('playerDestroy', (player) => {
        clearProgressUpdater(player);
        if (player.skipVotes) player.skipVotes.clear();
    });

    client.manager = manager;
    return manager;
}

module.exports = {
    initMusicManager,
    buildNowPlayingPayload,
    buildMusicProgressBar,
    startProgressUpdater,
    clearProgressUpdater,
    formatDuration,
    APP_EMOJIS
};
