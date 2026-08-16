const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imdb')
        .setDescription('IMDb üzerinde film ve dizi arar, puanlarını ve özetini listeler.')
        .addStringOption(opt =>
            opt.setName('film')
                .setDescription('Aranacak film veya dizi adı')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('film');

        try {
            const res = await fetch(`https://api.popcat.xyz/imdb?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('Film bulunamadı.');
            const data = await res.json();

            if (data.error) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`,
                    `\`${query}\` aramasıyla eşleşen herhangi bir film veya dizi bulunamadı.`,
                    '#ED4245', [], [], false
                ));
            }

            const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> IMDb: ${data.title} (${data.year})`;
            const desc = `${data.plot ? `> ${data.plot}\n\n` : ''}` +
                         `[IMDb Sayfasında Görüntüle](${data.imdburl || `https://www.imdb.com/find?q=${encodeURIComponent(query)}`})`;

            const fields = [
                { name: 'IMDb Puanı', value: `⭐ \`${data.ratings || data.rating || 'N/A'}/10\``, inline: true },
                { name: 'Tür', value: `\`${data.genres || 'Bilinmiyor'}\``, inline: true },
                { name: 'Süre', value: `\`${data.runtime || 'N/A'}\``, inline: true },
                { name: 'Yönetmen', value: `\`${data.director || 'Bilinmiyor'}\``, inline: true },
                { name: 'Başrol Oyuncuları', value: `\`${data.actors || 'Bilinmiyor'}\``, inline: false }
            ];

            const payload = createContainerMessage(title, desc, '#F5C518', [], fields, false);

            if (data.poster && data.poster.startsWith('http')) {
                return interaction.editReply({
                    ...payload,
                    files: [data.poster]
                });
            }

            return interaction.editReply(payload);
        } catch (error) {
            console.error('IMDb hatası:', error);
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                'IMDb verileri çekilirken bir hata oluştu: ' + error.message,
                '#ED4245', [], [], false
            ));
        }
    }
};
