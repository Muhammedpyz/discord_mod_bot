const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const RIZZ_LINES = [
    'Wi-Fi mısın acaba? Çünkü seninle aramızda inanılmaz bir bağlantı hissediyorum.',
    'Gözlerin bir harita gibi, baktıkça içinde kayboluyorum.',
    'Büyücü müsün? Çünkü sana baktığım an etraftaki herkes yok oluyor.',
    'Google mısın? Çünkü aradığım her şeyi sende buldum.',
    'Kalbin bir cezaevi olsa, ömür boyu müebbet yemeye razıyım.',
    'Güneş misin? Çünkü her odaya girdiğinde etraf aydınlanıyor.',
    'Bir liran var mı? Anneme gelecekteki gelinini bulduğumu haber vermek istiyorum.',
    'Fotoğrafçı mısın? Çünkü seninle harika bir gelecek canlandırabiliyorum.',
    'Gözlerinin rengi ne bilmiyorum ama bana bakınca tüm dünya renkleniyor.',
    'Yorulmuş olmalısın... Çünkü bütün gün aklımın içinde koşup durdun.'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rizz')
        .setDescription('Eğlenceli ve komik tavlama replikleri gönderir.')
        .addUserOption(opt =>
            opt.setName('kullanici')
                .setDescription('Repliğin ithaf edileceği kullanıcı')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('kullanici');
        const randomLine = RIZZ_LINES[Math.floor(Math.random() * RIZZ_LINES.length)];

        let title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Tavlama Sözü (Rizz)`;
        let desc = `> *"${randomLine}"*`;

        if (target) {
            title = `<:mono:${MONO_EMOJIS.heart || '1538517512340119664'}> ${interaction.user.username} ➔ ${target.username}`;
            desc = `<@${target.id}>, sana özel bir mesaj var:\n\n> *"${randomLine}"*`;
        }

        return interaction.editReply(createContainerMessage(title, desc, '#EB459E', [], [], false));
    }
};
