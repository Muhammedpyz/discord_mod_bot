const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { buildNowPlayingPayload } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Şu an çalan şarkının bilgilerini ve canlı ilerleme durumunu gösterir.'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const errPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Çalan Şarkı Yok`,
                'Şu anda bu sunucuda çalan herhangi bir müzik bulunmuyor.',
                '#2B2D31'
            );
            return await interaction.editReply(errPayload);
        }

        const payload = buildNowPlayingPayload(player, player.queue.current);
        return await interaction.editReply(payload);
    }
};
