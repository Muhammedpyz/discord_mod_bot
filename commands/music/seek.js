const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { formatDuration } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Çalan şarkıyı belirli bir saniyeye veya dakikaya sarar.')
        .addStringOption(opt => 
            opt.setName('zaman')
                .setDescription('Örnek: 1:30 veya 90 (saniye cinsinden)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Sarma işlemi yapabilmek için aktif bir müzik çalmalıdır.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        const timeInput = interaction.options.getString('zaman').trim();
        let targetMs = 0;

        if (timeInput.includes(':')) {
            const parts = timeInput.split(':').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                targetMs = (parts[0] * 60 + parts[1]) * 1000;
            }
        } else {
            const sec = parseInt(timeInput);
            if (!isNaN(sec)) targetMs = sec * 1000;
        }

        const trackLength = player.queue.current.length;
        if (targetMs < 0 || targetMs > trackLength) {
            const outOfBounds = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Geçersiz Süre`,
                `Lütfen \`0:00\` ile \`${formatDuration(trackLength)}\` arasında geçerli bir süre belirtin.`,
                '#ED4245'
            );
            return await interaction.editReply(outOfBounds);
        }

        player.seek(targetMs);

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.disc_3 || '1537767766566768681'}> Şarkı Sarıldı`,
            `Şarkı konumu başarıyla \`${formatDuration(targetMs)}\` noktasına sarıldı.`,
            '#57F287'
        );
        return await interaction.editReply(payload);
    }
};
