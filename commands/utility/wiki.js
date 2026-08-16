const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wiki')
        .setDescription('Vikipedi (Wikipedia) üzerinde konu veya madde araması yapar.')
        .addStringOption(opt =>
            opt.setName('konu')
                .setDescription('Aranacak konu veya terim')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('konu');

        try {
            // Önce Türkçe Wikipedia'da ara
            let res = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
            let data = await res.json();

            // Eğer Türkçe bulunamazsa İngilizce ara
            if (data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' || !data.extract) {
                res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                data = await res.json();
            }

            if (!data.extract) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Madde Bulunamadı`,
                    `\`${query}\` terimiyle ilgili Vikipedi maddesi bulunamadı.`,
                    '#ED4245', [], [], false
                ));
            }

            const title = `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Vikipedi: ${data.title}`;
            const articleUrl = data.content_urls ? data.content_urls.desktop.page : `https://tr.wikipedia.org/wiki/${encodeURIComponent(query)}`;
            
            let extract = data.extract;
            if (extract.length > 900) {
                extract = extract.substring(0, 897) + '...';
            }

            const desc = `> ${extract}\n\n[Maddenin Tamamını Oku](${articleUrl})`;

            const payload = createContainerMessage(title, desc, '#5865F2', [], [], false);

            if (data.thumbnail && data.thumbnail.source) {
                return interaction.editReply({
                    ...payload,
                    files: [data.thumbnail.source]
                });
            }

            return interaction.editReply(payload);
        } catch (error) {
            console.error('Wiki arama hatası:', error);
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                'Vikipedi verisi çekilirken bir sorun oluştu: ' + error.message,
                '#ED4245', [], [], false
            ));
        }
    }
};
