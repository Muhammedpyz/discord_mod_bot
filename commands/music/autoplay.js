const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Kuyruk bittiğinde otomatik benzer şarkı çalma modunu açar veya kapatır.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Aktif Çalma Yok`,
                'Autoplay özelliğini ayarlamak için ses kanalında aktif bir oynatıcı bulunmalıdır.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        const currentStatus = Boolean(player.data.get('autoplay'));
        const newStatus = !currentStatus;
        player.data.set('autoplay', newStatus);

        const statusLabel = newStatus ? '`[ AKTİF ]`' : '`[ DEVRE DIŞI ]`';
        const desc = newStatus
            ? 'Kuyruktaki şarkılar bittiğinde sistem son dinlenen parçaya göre otomatik benzer şarkılar çalmaya devam edecektir.'
            : 'Otomatik şarkı tamamlama kapatıldı. Kuyruk bittiğinde müzik duracaktır.';

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.refresh || MONO_EMOJIS.music_note || '1530917536806469783'}> Autoplay ${statusLabel}`,
            desc,
            newStatus ? '#57F287' : '#2B2D31'
        );
        return await interaction.editReply(payload);
    }
};
