const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');
const axios = require('axios');

async function fetchLyricsFromLRCLIB(query) {
    try {
        const res = await axios.get('https://lrclib.net/api/search', {
            params: { q: query },
            headers: { 'User-Agent': 'Nyx-Music-Bot/1.0' },
            timeout: 6000
        });
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            // İlk geçerli sözü olan kaydı bul
            const match = res.data.find(d => (d.plainLyrics || d.syncedLyrics)) || res.data[0];
            const lyrics = match.plainLyrics || match.syncedLyrics;
            if (lyrics) {
                return {
                    title: match.trackName || query,
                    artist: match.artistName || '',
                    lyrics: lyrics.trim()
                };
            }
        }
    } catch (e) {
        // Fallback'e geç
    }
    return null;
}

async function fetchLyricsFromOvh(artist, title) {
    try {
        const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, {
            timeout: 5000
        });
        if (res.data && res.data.lyrics) {
            return {
                title,
                artist,
                lyrics: res.data.lyrics.trim()
            };
        }
    } catch (e) {
        // Fallback
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Çalan şarkının veya aranan şarkının sözlerini görüntüler.')
        .addStringOption(opt => 
            opt.setName('sarki')
                .setDescription('Şarkı adı (Belirtilmezse çalan şarkı aranır)')
                .setRequired(false)
        )
        .setDMPermission(false),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const player = client.manager?.players?.get(interaction.guildId);

        let query = interaction.options.getString('sarki');
        if (!query) {
            if (player && player.queue?.current) {
                query = player.queue.current.title;
            } else {
                const err = createContainerMessage(
                    'Şarkı Belirtilmedi',
                    'Şu an çalan bir şarkı yok. Lütfen aramak istediğiniz şarkının adını yazın:\n> Örnek: `/lyrics sarki:Starboy`',
                    COLORS.ERROR || '#ED4245'
                );
                err.flags = MessageFlags.IsComponentsV2;
                return await interaction.editReply(err);
            }
        }

        // Temizleme (örn. Official Video, Feat, Remastered vb.)
        const cleanQuery = query
            .replace(/(\(|\[).*?(official|video|audio|lyrics|hd|4k|remastered|feat|ft\.).*?(\)|\])/gi, '')
            .replace(/ft\..*|feat\..*/i, '')
            .replace(/[\(\[\{].*?[\)\]\}]/g, '')
            .replace(/[-–—]/g, ' ')
            .trim();

        try {
            let result = await fetchLyricsFromLRCLIB(cleanQuery || query);

            if (!result && cleanQuery) {
                // Şarkıcı ve şarkı adını ayırıp dene
                const parts = query.split(/[-–—]/).map(p => p.trim());
                if (parts.length >= 2) {
                    result = await fetchLyricsFromOvh(parts[0], parts[1]);
                }
            }

            if (!result || !result.lyrics) {
                const notFound = createContainerMessage(
                    'Sözler Bulunamadı',
                    `**"${cleanQuery || query}"** için şarkı sözü bulunamadı.\nLütfen şarkı ve sanatçı adını daha net yazarak tekrar deneyin (Örn: \`/lyrics sarki:The Weeknd Starboy\`).`,
                    COLORS.WARNING || '#FEE75C'
                );
                notFound.flags = MessageFlags.IsComponentsV2;
                return await interaction.editReply(notFound);
            }

            let displayLyrics = result.lyrics;
            if (displayLyrics.length > 3500) {
                displayLyrics = displayLyrics.substring(0, 3500) + '\n\n*(Sözler çok uzun olduğu için kısaltıldı)*';
            }

            const headerInfo = result.artist ? `**Sanatçı:** \`${result.artist}\` | **Parça:** \`${result.title}\`` : `**Parça:** \`${result.title}\``;
            const desc = [
                headerInfo,
                ``,
                displayLyrics
            ].join('\n');

            const payload = createContainerMessage(
                `Şarkı Sözleri: ${result.title}`,
                desc,
                COLORS.PRIMARY || '#5865F2'
            );
            payload.flags = MessageFlags.IsComponentsV2;
            return await interaction.editReply(payload);
        } catch (e) {
            console.error('[Lyrics Error]:', e.message);
            const err = createContainerMessage(
                'Arama Hatası',
                'Şarkı sözleri aranırken beklenmeyen bir hata oluştu.',
                COLORS.ERROR || '#ED4245'
            );
            err.flags = MessageFlags.IsComponentsV2;
            return await interaction.editReply(err);
        }
    }
};
