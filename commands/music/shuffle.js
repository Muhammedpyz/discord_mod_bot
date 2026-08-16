const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Sıradaki şarkıları rastgele karıştırır.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || player.queue.length < 2) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Yetersiz Şarkı`,
                'Sırayı karıştırmak için sırada en az 2 şarkı bulunmalıdır.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        player.queue.shuffle();

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Sıra Karıştırıldı`,
            `Sıradaki **${player.queue.length}** şarkı başarıyla rastgele karıştırıldı!`,
            '#57F287'
        );
        return await interaction.editReply(payload);
    }
};
