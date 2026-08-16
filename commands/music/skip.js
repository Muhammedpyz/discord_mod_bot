const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Çalan şarkıyı atlar ve sıradaki şarkıya geçer.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Şu anda atlanabilecek bir müzik bulunmuyor.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        const skippedTitle = player.queue.current.title;
        player.skip();

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.forward || '1530917536806469783'}> Şarkı Atlandı`,
            `**${skippedTitle}** şarkısı atlandı, sıradaki parçaya geçiliyor.`,
            '#5865F2'
        );
        return await interaction.editReply(payload);
    }
};
