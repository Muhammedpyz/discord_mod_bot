const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Canlı müzik ses efektlerini ve ekolayzır filtrelerini ayarlar.')
        .addStringOption(opt => 
            opt.setName('efekt')
                .setDescription('Uygulanacak ses efekti')
                .setRequired(true)
                .addChoices(
                    { name: 'Bassboost (Derin Bas Güçlendirici)', value: 'bassboost' },
                    { name: 'Nightcore (Hızlı & Tiz)', value: 'nightcore' },
                    { name: '8D Audio (Dönen 3D Çevreleyen Ses)', value: '8d' },
                    { name: 'Vaporwave (Yavaş & Nostaljik)', value: 'vaporwave' },
                    { name: 'Filtreleri Sıfırla (Normal Ses)', value: 'clear' }
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const player = client.manager?.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            const err = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Çalan Şarkı Yok`,
                'Ses filtrelerini uygulamak için şu an bir müzik çalmalıdır.',
                '#ED4245'
            );
            return await interaction.editReply(err);
        }

        const effect = interaction.options.getString('efekt');
        const shoukakuPlayer = player.shoukaku;

        if (effect === 'bassboost') {
            await shoukakuPlayer.setEqualizer([
                { band: 0, gain: 0.2 },
                { band: 1, gain: 0.15 },
                { band: 2, gain: 0.1 },
                { band: 3, gain: 0.05 }
            ]);
            player.filterName = 'Bassboost';
        } else if (effect === 'nightcore') {
            await shoukakuPlayer.setTimescale({ speed: 1.15, pitch: 1.2, rate: 1.0 });
            player.filterName = 'Nightcore';
        } else if (effect === '8d') {
            await shoukakuPlayer.setRotation({ rotationHz: 0.2 });
            player.filterName = '8D Audio';
        } else if (effect === 'vaporwave') {
            await shoukakuPlayer.setTimescale({ speed: 0.85, pitch: 0.8, rate: 1.0 });
            player.filterName = 'Vaporwave';
        } else if (effect === 'clear') {
            await shoukakuPlayer.clearFilters();
            player.filterName = 'Normal';
        }

        const effectNames = {
            bassboost: 'Bassboost (Derin Bas)',
            nightcore: 'Nightcore (Hızlı & Tiz)',
            '8d': '8D Audio (3D Çevreleyen Ses)',
            vaporwave: 'Vaporwave (Yavaş & Nostaljik)',
            clear: 'Normal (Tüm Filtreler Sıfırlandı)'
        };

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Ses Filtresi Uygulandı`,
            `Aktif Filtre: **${effectNames[effect]}**`,
            '#5865F2'
        );
        return await interaction.editReply(payload);
    }
};
