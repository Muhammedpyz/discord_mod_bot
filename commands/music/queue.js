const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { formatDuration } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Sıradaki şarkıların listesini gösterir.')
        .addIntegerOption(opt => 
            opt.setName('sayfa')
                .setDescription('Görüntülenecek sayfa numarası')
                .setRequired(false)
                .setMinValue(1)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();

        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const errPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Çalan Şarkı Yok`,
                'Şu anda sırada veya çalınan herhangi bir müzik bulunmuyor.',
                '#2B2D31'
            );
            return await interaction.editReply(errPayload);
        }

        const currentTrack = player.queue.current;
        const queueList = player.queue;
        const page = interaction.options.getInteger('sayfa') || 1;
        const pageSize = 10;
        const totalPages = Math.ceil(queueList.length / pageSize) || 1;

        const startIndex = (page - 1) * pageSize;
        const currentSlice = queueList.slice(startIndex, startIndex + pageSize);

        let desc = `### <:mono:${MONO_EMOJIS.disc_2 || '1537767790394482688'}> Şu An Çalıyor:\n` +
                   `[${currentTrack.title}](${currentTrack.uri}) — \`${formatDuration(currentTrack.length)}\`\n\n` +
                   `### <:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Sıradaki Parçalar (Toplam: ${queueList.length}):\n`;

        if (currentSlice.length === 0) {
            desc += `*Sırada başka şarkı yok.*`;
        } else {
            desc += currentSlice.map((t, idx) => {
                const globalIndex = startIndex + idx + 1;
                return `\`${globalIndex}.\` [${t.title}](${t.uri}) — \`${formatDuration(t.length)}\``;
            }).join('\n');
        }

        desc += `\n\n*Sayfa ${page} / ${totalPages}*`;

        const queuePayload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Müzik Çalma Sırası`,
            desc,
            '#5865F2'
        );

        return await interaction.editReply(queuePayload);
    }
};
