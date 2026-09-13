const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createContainerMessage, buildModBResponse } = require('../../utils/uiBuilder');
const { Jimp } = require('jimp');

module.exports = [
    {
        data: new SlashCommandBuilder().setName('efekt').setDescription('Profil fotoğrafına efekt uygular.')
            .addStringOption(o => o.setName('tur').setDescription('Efekt').setRequired(true).addChoices(
                { name: 'Gri', value: 'gri' }, { name: 'Negatif', value: 'negatif' },
                { name: 'Blur', value: 'blur' }, { name: 'Parlak', value: 'parlak' },
                { name: 'Karanlık', value: 'karanlik' }
            ))
            .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı (boşsa sen)').setRequired(false)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const user = interaction.options.getUser('kullanici') || interaction.user;
            const tur = interaction.options.getString('tur');
            try {
                const url = user.displayAvatarURL({ extension: 'png', size: 256 });
                const img = await Jimp.read(url);
                img.cover({ w: 256, h: 256 });
                if (tur === 'gri') img.greyscale();
                else if (tur === 'negatif') img.invert();
                else if (tur === 'blur') img.blur(5);
                else if (tur === 'parlak') img.brightness(0.3);
                else if (tur === 'karanlik') img.brightness(-0.3);
                const buf = await img.getBuffer('image/png');
                const file = new AttachmentBuilder(buf, { name: 'efekt.png' });
                const payload = buildModBResponse({ title: `Efekt: ${tur}`, textLines: [`${user.username} için hazır!`], files: [file] });
                payload.files = [file];
                await interaction.editReply({ ...payload, files: [file] });
            } catch (e) {
                console.error('[Efekt]:', e.message);
                await interaction.editReply(createContainerMessage('Hata', 'Efekt uygulanamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
        }
    },
    {
        data: new SlashCommandBuilder().setName('kedi').setDescription('Rastgele kedi fotoğrafı/GIF atar.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { MONO_EMOJIS } = require('../../utils/uiBuilder');
            const url = `https://cataas.com/cat?t=${Date.now()}`;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kedi_yeni').setLabel('Yeni Kedi').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = buildModBResponse({ title: 'Kedi', textLines: ['Al sana bir kedi!'], images: [url], actionRows: [row] });
            await interaction.editReply(payload);
        }
    },
    {
        data: new SlashCommandBuilder().setName('köpek').setDescription('Rastgele köpek fotoğrafı atar.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            try {
                const res = await fetch('https://dog.ceo/api/breeds/image/random', { headers: { 'User-Agent': 'NyxBot/1.0' }, signal: AbortSignal.timeout(10000) });
                const d = await res.json();
                const { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
                const { MONO_EMOJIS: ME } = require('../../utils/uiBuilder');
                const row = new AR().addComponents(new BB().setCustomId('kopek_yeni').setLabel('Yeni Köpek').setStyle(BS.Secondary).setEmoji(ME.refresh));
                const payload = buildModBResponse({ title: 'Köpek', textLines: ['Al sana bir köpek!'], images: [d.message], actionRows: [row] });
                await interaction.editReply(payload);
            } catch (e) {
                await interaction.editReply(createContainerMessage('Hata', 'Köpek bulunamadı, tekrar dene.', '#ED4245', [], [], false, true)).catch(() => {});
            }
        }
    }
];
