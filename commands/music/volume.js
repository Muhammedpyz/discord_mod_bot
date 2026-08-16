const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Müzik ses seviyesini ayarlar.')
        .addIntegerOption(opt => 
            opt.setName('seviye')
                .setDescription('Ses seviyesi (0 - 150)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(150)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Ses seviyesini ayarlamak için aktif bir müzik çalmalıdır.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        const volume = interaction.options.getInteger('seviye');
        player.setVolume(volume);
        await db.updateMusicConfig(interaction.guildId, { default_volume: volume }).catch(() => {});

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Ses Seviyesi Güncellendi`,
            `Ses seviyesi **%${volume}** olarak ayarlandı.`,
            '#57F287'
        );
        return await interaction.editReply(payload);
    }
};
