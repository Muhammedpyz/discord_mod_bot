const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Müzik veya sıra döngü modunu ayarlar.')
        .addStringOption(opt => 
            opt.setName('mod')
                .setDescription('Döngü türü')
                .setRequired(true)
                .addChoices(
                    { name: 'Şarkı Döngüsü (Mevcut Parça)', value: 'track' },
                    { name: 'Sıra Döngüsü (Tüm Liste)', value: 'queue' },
                    { name: 'Döngüyü Kapat', value: 'none' }
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Döngü modunu ayarlamak için aktif bir müzik çalmalıdır.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        const mode = interaction.options.getString('mod');
        player.setLoop(mode);

        const modeLabels = {
            track: 'Şarkı Döngüsü (Mevcut Parça Sürekli Tekrar Edecek)',
            queue: 'Sıra Döngüsü (Tüm Liste Başa Saracak)',
            none: 'Kapalı (Normal Çalma)'
        };

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.repeat || '1530917536806469783'}> Döngü Modu Güncellendi`,
            `Döngü modu: **${modeLabels[mode]}**`,
            '#5865F2'
        );
        return await interaction.editReply(payload);
    }
};
