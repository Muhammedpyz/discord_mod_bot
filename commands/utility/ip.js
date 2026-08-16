const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Bir IP adresi veya domain hakkında coğrafi ve servis sağlayıcı (ISP) bilgisi verir.')
        .addStringOption(opt =>
            opt.setName('adres')
                .setDescription('Sorgulanacak IP veya domain (Örn: 8.8.8.8 veya google.com)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const query = interaction.options.getString('adres');

        try {
            const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(query)}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
            const data = await res.json();

            if (data.status !== 'success') {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Geçersiz Adres`,
                    `\`${query}\` adresi sorgulanamadı: ${data.message || 'Hata'}`,
                    '#ED4245', [], [], false
                ));
            }

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> IP Sorgusu: ${data.query}`;
            const desc = `Coğrafi konum ve internet servis sağlayıcısı (ISP) detayları:`;

            const fields = [
                { name: 'Ülke / Şehir', value: `\`${data.country} (${data.countryCode}) / ${data.city}\``, inline: true },
                { name: 'Bölge / Posta Kodu', value: `\`${data.regionName} / ${data.zip || 'N/A'}\``, inline: true },
                { name: 'Zaman Dilimi', value: `\`${data.timezone}\``, inline: true },
                { name: 'İnternet Sağlayıcı (ISP)', value: `\`${data.isp}\``, inline: true },
                { name: 'Organizasyon / AS', value: `\`${data.org || data.as || 'N/A'}\``, inline: false },
                { name: 'Koordinatlar (Enlem/Boylam)', value: `\`${data.lat}, ${data.lon}\``, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        } catch (error) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                'IP verileri alınırken bir hata oluştu: ' + error.message,
                '#ED4245', [], [], false
            ));
        }
    }
};
