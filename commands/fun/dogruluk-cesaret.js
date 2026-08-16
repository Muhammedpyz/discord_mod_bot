const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const TRUTHS = [
    'Bu sunucuda gizliden gizliye hoşlandığın biri var mı?',
    'Hayatında yaptığın en utanç verici şey neydi?',
    'Son 24 saat içinde söylediğin en büyük yalan neydi?',
    'Telefonundaki arama geçmişinde en son ne arattın?',
    'Hiç bir arkadaşının arkasından konuştun mu?',
    'Eğer görünmez olsaydın yapacağın ilk 3 şey ne olurdu?',
    'En son ne zaman ve neden ağladın?',
    'Hiç kimseye anlatmadığın en büyük sırrın nedir?',
    'Bu sunucuda en çok kime gıcıksın?',
    'Hiç yakalandığın komik bir anın oldu mu?',
    'Bir adaya düşsen yanına alacağın 3 sunucu üyesi kim olurdu?',
    'En saçma takıntın nedir?',
    'Hiç aşık oldun mu ve ilk aşkın kimdi?',
    'Geçmişte yaptığın ve şu an çok pişman olduğun bir şey var mı?'
];

const DARES = [
    'Sunucudaki rastgele birine DM atıp "Seni uzun zamandır izliyorum" yaz ve ekran görüntüsünü at.',
    'Ses kanalına girip 15 saniye boyunca opera gibi şarkı söyle.',
    'Discord durumuna 1 saat boyunca "Ben bir patatesim" yaz.',
    'Sunucudaki bir yetkiliyi etiketleyip "Beni banla cesaretin varsa" yaz.',
    'Profil fotoğrafını 30 dakika boyunca komik bir maymun fotoğrafı yap.',
    'En son konuştuğun 3 kişiye rastgele bir yemek emojisi at.',
    'Ses kanalında mikrofona en iyi hayvan taklidini yap.',
    'Sunucudaki bir üyeye iltifat dolu 3 cümle yaz.',
    '1 dakika boyunca ses kanalında sadece tekerleme söyle.',
    'Genel sohbete en utanç verici anını detaylıca yaz.'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dc')
        .setDescription('Doğruluk mu Cesaret mi oyunu için soru veya görev çeker.')
        .addSubcommand(sub =>
            sub.setName('dogruluk')
                .setDescription('Rastgele bir doğruluk sorusu sorar.')
        )
        .addSubcommand(sub =>
            sub.setName('cesaret')
                .setDescription('Rastgele bir cesaret görevi verir.')
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const user = interaction.user;

        if (sub === 'dogruluk') {
            const randomTruth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
            const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Doğruluk Sorusu — ${user.username}`;
            const desc = `Dürüstçe cevap ver:\n\n> **${randomTruth}**`;

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], [], false));
        }

        if (sub === 'cesaret') {
            const randomDare = DARES[Math.floor(Math.random() * DARES.length)];
            const title = `<:mono:${MONO_EMOJIS.fire || '1537767765103083541'}> Cesaret Görevi — ${user.username}`;
            const desc = `Görevi yerine getirmeye cesaretin var mı?\n\n> **${randomDare}**`;

            return interaction.editReply(createContainerMessage(title, desc, '#ED4245', [], [], false));
        }
    }
};
