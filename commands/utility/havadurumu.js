const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('havadurumu')
        .setDescription('Belirtilen şehir için güncel hava durumu raporunu görüntüler.')
        .addStringOption(opt =>
            opt.setName('sehir')
                .setDescription('Hava durumu sorgulanacak şehir (Örn: Istanbul, Ankara, Izmir)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const city = interaction.options.getString('sehir');

        try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=tr`);
            if (!res.ok) throw new Error('Şehir bulunamadı.');
            const data = await res.json();

            const current = data.current_condition[0];
            const area = data.nearest_area[0];
            const cityName = area.areaName[0].value;
            const country = area.country[0].value;

            const tempC = current.temp_C;
            const feelsLikeC = current.FeelsLikeC;
            const humidity = current.humidity;
            const windSpeed = current.windspeedKmph;
            const weatherDesc = current.lang_tr ? current.lang_tr[0].value : current.weatherDesc[0].value;

            const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Hava Durumu: ${cityName}, ${country}`;
            const desc = `🌤️ **Genel Durum:** \`${weatherDesc}\``;

            const fields = [
                { name: 'Sıcaklık', value: `\`${tempC}°C\``, inline: true },
                { name: 'Hissedilen', value: `\`${feelsLikeC}°C\``, inline: true },
                { name: 'Nem Oranı', value: `\`%${humidity}\``, inline: true },
                { name: 'Rüzgar Hızı', value: `\`${windSpeed} km/s\``, inline: true },
                { name: 'UV İndeksi', value: `\`${current.uvIndex}\``, inline: true },
                { name: 'Bulut Oranı', value: `\`%${current.cloudcover}\``, inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#3498DB', [], fields, false));
        } catch (error) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Şehir Bulunamadı`,
                `\`${city}\` şehri için hava durumu bilgisi alınamadı.`,
                '#ED4245', [], [], false
            ));
        }
    }
};
