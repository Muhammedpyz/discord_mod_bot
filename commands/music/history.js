const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music-history')
        .setDescription('Bu sunucuda son çalınan şarkıların geçmiş listesini gösterir.'),

    async execute(interaction, client) {
        await interaction.deferReply();
        const historyList = await db.getMusicHistory(interaction.guildId, 10);

        if (!historyList.length) {
            const empty = createContainerMessage(
                `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Müzik Geçmişi Boş`,
                'Bu sunucuda henüz hiç müzik çalınmamış.',
                '#2B2D31'
            );
            return await interaction.editReply(empty);
        }

        const listText = historyList.map((h, idx) => {
            return `\`${idx + 1}.\` [${h.track_title}](${h.track_url}) — <@${h.user_id}>`;
        }).join('\n');

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Son Çalınan Müzikler Geçmişi`,
            listText,
            '#5865F2'
        );
        return await interaction.editReply(payload);
    }
};
