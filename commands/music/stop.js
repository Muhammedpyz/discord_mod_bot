const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Müziği tamamen durdurur, sırayı temizler ve ses kanalından ayrılır.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Bot şu anda herhangi bir ses kanalında çalmıyor.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        player.destroy();

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.trash || '1530917536806469783'}> Müzik Durduruldu`,
            `<@${interaction.user.id}> tarafından müzik tamamen durduruldu ve ses kanalından ayrıldım.`,
            '#ED4245'
        );
        return await interaction.editReply(payload);
    }
};
