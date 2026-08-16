const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const lyricsFinder = require('@flytri/lyrics-finder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Çalan şarkının veya aranan şarkının sözlerini görüntüler.')
        .addStringOption(opt => 
            opt.setName('sarki')
                .setDescription('Şarkı adı (Belirtilmezse çalan şarkı aranır)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        let query = interaction.options.getString('sarki');
        if (!query) {
            if (player && player.queue.current) {
                query = player.queue.current.title;
            } else {
                const err = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Şarkı Belirtilmedi`,
                    'Şu an çalan bir şarkı yok. Lütfen aramak istediğiniz şarkının adını yazın: `/lyrics sarki:Starboy`',
                    '#ED4245'
                );
                return await interaction.editReply(err);
            }
        }

        // Temizleme (örn. Official Video, Feat vb.)
        const cleanQuery = query.replace(/(\(|\[).*?(\)|\])/g, '').replace(/ft\..*|feat\..*/i, '').trim();

        try {
            const result = await lyricsFinder.LyricsFinder(cleanQuery);
            if (!result || !result.lyrics) {
                const notFound = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917536806469783'}> Sözler Bulunamadı`,
                    `**"${cleanQuery}"** için şarkı sözü bulunamadı.`,
                    '#2B2D31'
                );
                return await interaction.editReply(notFound);
            }

            const truncatedLyrics = result.lyrics.length > 3500 
                ? result.lyrics.substring(0, 3500) + '...\n\n*(Sözler çok uzun olduğu için kısaltıldı)*' 
                : result.lyrics;

            const payload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Şarkı Sözleri: ${cleanQuery}`,
                truncatedLyrics,
                '#5865F2'
            );
            return await interaction.editReply(payload);
        } catch (e) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Arama Hatası`,
                'Şarkı sözleri aranırken bir sorun oluştu.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }
    }
};
