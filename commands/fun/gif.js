const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { gifCard, PROVIDERS } = require('../../utils/gifHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Rastgele GIF atar (Tenor destekli).')
        .addStringOption(o => o.setName('konu').setDescription('GIF konusu').setRequired(true).addChoices(
            { name: 'Sarılma', value: 'saril' },
            { name: 'Öpücük', value: 'opucuk' },
            { name: 'Okşama', value: 'oksama' },
            { name: 'Tokat', value: 'tokat' },
            { name: 'Dans', value: 'dans' },
            { name: 'Kucaklaşma', value: 'kucaklasma' },
            { name: 'Besleme', value: 'besle' },
            { name: 'Kedi', value: 'kedi' },
            { name: 'Köpek', value: 'kopek' }
        ))
        .addUserOption(o => o.setName('hedef').setDescription('Kime gönderilsin? (etiketlenir)').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
        const konu = interaction.options.getString('konu');
        const hedef = interaction.options.getUser('hedef');
        const { fetchGif } = require('../../utils/gifHandler');
        try {
            const url = await fetchGif(konu);
            await interaction.editReply({ ...gifCard(url, konu, hedef ? hedef.id : null), flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
            console.error('[GIF] Komut hatası:', e.message);
            const { createContainerMessage } = require('../../utils/uiBuilder');
            await interaction.editReply(createContainerMessage('Hata', 'GIF alınırken bir sorun oluştu, birazdan tekrar dene.', '#ED4245')).catch(() => {});
        }
    }
};
