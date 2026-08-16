const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const PFP_APIS = {
    'anime': async () => {
        try {
            const res = await fetch('https://nekos.best/api/v2/neko');
            if (res.ok) {
                const data = await res.json();
                return data.results && data.results[0] ? data.results[0].url : null;
            }
        } catch (e) {}
        return 'https://picsum.photos/512/512';
    },
    'erkek': async () => {
        const id = Math.floor(Math.random() * 90) + 1;
        return `https://randomuser.me/api/portraits/men/${id}.jpg`;
    },
    'kadin': async () => {
        const id = Math.floor(Math.random() * 90) + 1;
        return `https://randomuser.me/api/portraits/women/${id}.jpg`;
    },
    'random': async () => {
        return `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/512/512`;
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pfp')
        .setDescription('Kategorilere göre rastgele yüksek çözünürlüklü profil fotoğrafları bulur.')
        .addStringOption(opt =>
            opt.setName('kategori')
                .setDescription('Aranacak avatar kategorisi')
                .setRequired(true)
                .addChoices(
                    { name: 'Anime Avatar', value: 'anime' },
                    { name: 'Erkek Avatar (Male)', value: 'erkek' },
                    { name: 'Kadın Avatar (Female)', value: 'kadin' },
                    { name: 'Rastgele Estetik (Random)', value: 'random' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const category = interaction.options.getString('kategori');
        const fetcher = PFP_APIS[category] || PFP_APIS['random'];
        const imageUrl = await fetcher();

        const catTr = {
            'anime': 'Anime Avatarı',
            'erkek': 'Erkek Profil Fotoğrafı',
            'kadin': 'Kadın Profil Fotoğrafı',
            'random': 'Rastgele Estetik Avatar'
        }[category];

        const title = `<:mono:${MONO_EMOJIS.image || '1537767789098307615'}> ${catTr}`;
        const desc = `Sizin için özel bir profil fotoğrafı bulundu. İndirmek için görsele tıklayabilirsiniz.`;

        const payload = createContainerMessage(title, desc, '#5865F2', [], [], false);
        return interaction.editReply({
            ...payload,
            files: [imageUrl]
        });
    }
};
