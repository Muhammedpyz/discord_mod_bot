const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Çalan müziği duraklatır.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Şu anda çalan herhangi bir müzik bulunmuyor.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        if (player.paused) {
            const alreadyPaused = createContainerMessage(
                `<:mono:${MONO_EMOJIS.pause || '1530917536806469783'}> Zaten Duraklatılmış`,
                'Müzik zaten duraklatılmış durumda. Devam ettirmek için `/resume` yazabilirsiniz.',
                '#FEE75C'
            );
            return await interaction.editReply(alreadyPaused);
        }

        player.pause(true);
        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.pause || '1530917536806469783'}> Müzik Duraklatıldı`,
            'Müzik başarıyla duraklatıldı. Devam ettirmek için `/resume` komutunu kullanabilirsiniz.',
            '#FEE75C'
        );
        return await interaction.editReply(payload);
    }
};
