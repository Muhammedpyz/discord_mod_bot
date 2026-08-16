const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const ANIMAL_APIS = {
    'kedi': {
        img: 'https://api.thecatapi.com/v1/images/search',
        parse: (d) => d[0]?.url,
        fact: 'Kediler hayatlarının yaklaşık %70ini uyuyarak geçirirler.'
    },
    'kopek': {
        img: 'https://dog.ceo/api/breeds/image/random',
        parse: (d) => d?.message,
        fact: 'Köpeklerin koku alma duyusu insanlarınkinden en az 40 kat daha güçlüdür.'
    },
    'tilki': {
        img: 'https://randomfox.ca/floof/',
        parse: (d) => d?.image,
        fact: 'Tilkiler yönlerini bulmak ve avlanmak için Dünya’nın manyetik alanını kullanırlar.'
    },
    'panda': {
        img: 'https://some-random-api.com/animal/panda',
        parse: (d) => d?.image,
        fact: 'Dev pandalar günlerinin 12 saatini sadece bambu yiyerek geçirirler.'
    },
    'kus': {
        img: 'https://some-random-api.com/animal/bird',
        parse: (d) => d?.image,
        fact: 'Kuşların kemikleri uçmayı kolaylaştırmak için içi boş ve hava doludur.'
    },
    'koala': {
        img: 'https://some-random-api.com/animal/koala',
        parse: (d) => d?.image,
        fact: 'Koalalar günde 18-22 saat uyurlar ve sadece okaliptüs yaprağı yerler.'
    },
    'kanguru': {
        img: 'https://some-random-api.com/animal/kangaroo',
        parse: (d) => d?.image,
        fact: 'Kangurular geriye doğru yürüyemezler ve kuyruklarını üçüncü bir bacak gibi kullanırlar.'
    },
    'rakun': {
        img: 'https://some-random-api.com/animal/raccoon',
        parse: (d) => d?.image,
        fact: 'Rakunlar yiyeceklerini yemeden önce ellerinde su ile yıkama alışkanlığına sahiptirler.'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hayvan')
        .setDescription('Sevimli hayvan fotoğrafları ve ilginç bilgiler gösterir.')
        .addStringOption(opt =>
            opt.setName('tur')
                .setDescription('Görüntülenecek hayvan türü')
                .setRequired(true)
                .addChoices(
                    { name: 'Kedi (Cat)', value: 'kedi' },
                    { name: 'Köpek (Dog)', value: 'kopek' },
                    { name: 'Tilki (Fox)', value: 'tilki' },
                    { name: 'Panda', value: 'panda' },
                    { name: 'Kuş (Bird)', value: 'kus' },
                    { name: 'Koala', value: 'koala' },
                    { name: 'Kanguru (Kangaroo)', value: 'kanguru' },
                    { name: 'Rakun (Raccoon)', value: 'rakun' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const type = interaction.options.getString('tur');
        const animal = ANIMAL_APIS[type] || ANIMAL_APIS['kedi'];

        let imageUrl = null;
        try {
            const res = await fetch(animal.img);
            if (res.ok) {
                const data = await res.json();
                imageUrl = animal.parse(data);
            }
        } catch (e) {}

        const namesTr = {
            'kedi': 'Tatlı Kedi',
            'kopek': 'Sadık Köpek',
            'tilki': 'Kurnaz Tilki',
            'panda': 'Tonton Panda',
            'kus': 'Sevimli Kuş',
            'koala': 'Uykucu Koala',
            'kanguru': 'Zıpzıp Kanguru',
            'rakun': 'Haylaz Rakun'
        };

        const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> ${namesTr[type] || 'Sevimli Hayvan'}`;
        const desc = `💡 **İlginç Bilgi:** *${animal.fact}*`;

        const payload = createContainerMessage(title, desc, '#57F287', [], [], false);

        if (imageUrl) {
            return interaction.editReply({
                ...payload,
                files: [imageUrl]
            });
        }

        return interaction.editReply(payload);
    }
};
