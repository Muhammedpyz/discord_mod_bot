const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { games, gid, tkmCard, triviaCard, bumuRows, basarRows, TRIVIA, BUMU, BASAR } = require('../../utils/gameHandler');
const { pickWord } = require('../../utils/gameWords');

module.exports = [
    {
        data: new SlashCommandBuilder()        .setName('taş-kağıt-makas').setDescription('Bota karşı 3 tur oynarsın (kazanırsan 25 Jeton).'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const id = gid();
            games.set('tkm' + id, { user: interaction.user.id, tur: 0, ben: 0, bot: 0, son: null, t: Date.now() });
            await interaction.editReply(tkmCard(id, games.get('tkm' + id)));
        }
    },
    {
        data: new SlashCommandBuilder().setName('hızlı-yaz').setDescription('Kelimeyi hızlı yaz, süreye göre ödül kazan.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const word = pickWord();
            const id = gid();
            games.set('hizyaz' + id, { word, user: interaction.user.id, t0: Date.now(), t: Date.now() });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hizyaz_btn_${id}`).setLabel('Yazmaya Başla').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pin)
            );
            await interaction.editReply(createContainerMessage('Hızlı Yaz', `Kelime: **${word}**\n\nButona bas, aynısını hızlıca yaz!\n\n-# 5sn altı: 75 • 10sn altı: 50 • 20sn altı: 25 Jeton`, '#5865F2', [row]));
        }
    },
    {
        data: new SlashCommandBuilder()        .setName('bilgi-yarışması').setDescription('Genel kültür sorusu (doğru cevap +40 Jeton).'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const qi = Math.floor(Math.random() * TRIVIA.length);
            await interaction.editReply(triviaCard(qi));
        }
    },
    {
        data: new SlashCommandBuilder().setName('bunu-mu').setDescription('Bunu mu şunu mu oylaması başlatır.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const di = Math.floor(Math.random() * BUMU.length);
            const d = BUMU[di];
            const payload = createContainerMessage('Bunu mu Şunu mu', `**${d[0]}**\n\`░░░░░░░░░░\` %0 (0 oy)\n\n**${d[1]}**\n\`░░░░░░░░░░\` %0 (0 oy)`, '#5865F2', bumuRows(di));
            await interaction.editReply(payload);
        }
    },
    {
        data: new SlashCommandBuilder().setName('basar-mıydın').setDescription('Efsane buton ikilemi oylaması.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const di = Math.floor(Math.random() * BASAR.length);
            const payload = createContainerMessage('Basar mıydın', `**${BASAR[di]}**\n\nOyla ve sonucu canlı gör!`, '#5865F2', basarRows(di));
            await interaction.editReply(payload);
        }
    }
];
