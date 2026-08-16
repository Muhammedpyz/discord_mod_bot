const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steam')
        .setDescription('Steam mağazasında oyun arar ve detaylı bilgilerini listeler.')
        .addStringOption(opt =>
            opt.setName('oyun')
                .setDescription('Aranacak oyun adı')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('oyun');

        try {
            const searchRes = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=turkish&cc=tr`);
            if (!searchRes.ok) throw new Error('Steam API yanıt vermedi.');
            const searchData = await searchRes.json();

            if (!searchData.items || searchData.items.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Oyun Bulunamadı`,
                    `\`${query}\` aramasına uygun herhangi bir Steam oyunu bulunamadı.`,
                    '#ED4245', [], [], false
                ));
            }

            const bestMatch = searchData.items[0];
            const appId = bestMatch.id;

            const detailRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=turkish&cc=tr`);
            const detailData = await detailRes.json();
            const game = detailData[appId]?.data;

            if (!game) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Detay Alınamadı`,
                    'Oyun detayları yüklenirken bir sorun oluştu.',
                    '#ED4245', [], [], false
                ));
            }

            const priceStr = game.is_free 
                ? 'Ücretsiz (Free to Play)' 
                : (game.price_overview ? `${game.price_overview.final_formatted}` : 'Fiyat Bilinmiyor');

            const genres = game.genres ? game.genres.map(g => g.description).join(', ') : 'Belirtilmedi';
            const devs = game.developers ? game.developers.join(', ') : 'Belirtilmedi';
            const releaseDate = game.release_date ? game.release_date.date : 'Bilinmiyor';
            const score = game.metacritic ? `${game.metacritic.score}/100` : 'Puan Yok';

            const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Steam: ${game.name}`;
            const desc = `${game.short_description ? `> ${game.short_description}\n\n` : ''}` +
                         `[Steam Mağazasında Görüntüle](https://store.steampowered.com/app/${appId})`;

            const fields = [
                { name: 'Fiyat', value: `\`${priceStr}\``, inline: true },
                { name: 'Metacritic', value: `\`${score}\``, inline: true },
                { name: 'Çıkış Tarihi', value: `\`${releaseDate}\``, inline: true },
                { name: 'Geliştirici', value: `\`${devs}\``, inline: true },
                { name: 'Türler', value: `\`${genres}\``, inline: true }
            ];

            const payload = createContainerMessage(title, desc, '#1B2838', [], fields, false);

            if (game.header_image) {
                return interaction.editReply({
                    ...payload,
                    files: [game.header_image]
                });
            }

            return interaction.editReply(payload);
        } catch (error) {
            console.error('Steam arama hatası:', error);
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                'Steam verileri çekilirken bir hata oluştu: ' + error.message,
                '#ED4245', [], [], false
            ));
        }
    }
};
