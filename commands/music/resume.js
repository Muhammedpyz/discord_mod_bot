const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Duraklatılmış müziği devam ettirir.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Şu anda duraklatılmış bir müzik bulunmuyor.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        if (!player.paused) {
            const notPaused = createContainerMessage(
                `<:mono:${MONO_EMOJIS.play || '1530917536806469783'}> Müzik Çalıyor`,
                'Müzik zaten çalıyor durumda.',
                '#FEE75C'
            );
            return await interaction.editReply(notPaused);
        }

        player.pause(false);
        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.play || '1530917536806469783'}> Müzik Devam Ediyor`,
            'Müzik başarıyla devam ettirildi.',
            '#57F287'
        );
        return await interaction.editReply(payload);
    }
};
