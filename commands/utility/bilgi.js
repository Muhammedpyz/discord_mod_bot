const { SlashCommandBuilder } = require('discord.js');
const { runBilgi } = require('../../utils/bilgiHandler');

module.exports = [
    {
        data: new SlashCommandBuilder().setName('hava-durumu').setDescription('Şehir hava durumunu gösterir.')
            .addStringOption(o => o.setName('sehir').setDescription('Şehir adı').setRequired(true)),
        async execute(i) { await runBilgi(i, 'hava', i.options.getString('sehir')); }
    },
    {
        data: new SlashCommandBuilder().setName('çeviri').setDescription('Metni çevirir.')
            .addStringOption(o => o.setName('metin').setDescription('Çevrilecek metin').setRequired(true).setMaxLength(400))
            .addStringOption(o => o.setName('hedef').setDescription('Hedef dil').setRequired(true).addChoices(
                { name: 'Türkçe', value: 'tr' }, { name: 'İngilizce', value: 'en' },
                { name: 'Almanca', value: 'de' }, { name: 'Fransızca', value: 'fr' },
                { name: 'İspanyolca', value: 'es' }, { name: 'Arapça', value: 'ar' },
                { name: 'Rusça', value: 'ru' }, { name: 'Japonca', value: 'ja' }
            )),
        async execute(i) { await runBilgi(i, 'ceviri', i.options.getString('metin'), i.options.getString('hedef')); }
    },
    {
        data: new SlashCommandBuilder().setName('kripto').setDescription('Kripto fiyatını gösterir.')
            .addStringOption(o => o.setName('coin').setDescription('Örn: bitcoin, ethereum, solana').setRequired(true)),
        async execute(i) { await runBilgi(i, 'kripto', i.options.getString('coin')); }
    },
    {
        data: new SlashCommandBuilder().setName('döviz').setDescription('Güncel döviz kurlarını gösterir.'),
        async execute(i) { await runBilgi(i, 'doviz'); }
    },
    {
        data: new SlashCommandBuilder().setName('kısalt').setDescription('Uzun linki kısaltır.')
            .addStringOption(o => o.setName('link').setDescription('https:// ile başlayan link').setRequired(true)),
        async execute(i) { await runBilgi(i, 'kisalt', i.options.getString('link')); }
    },
    {
        data: new SlashCommandBuilder().setName('wikipedia').setDescription('Wikipedia özeti getirir.')
            .addStringOption(o => o.setName('terim').setDescription('Aranacak terim').setRequired(true)),
        async execute(i) { await runBilgi(i, 'wiki', i.options.getString('terim')); }
    },
    {
        data: new SlashCommandBuilder().setName('github').setDescription('GitHub repo bilgisi getirir.')
            .addStringOption(o => o.setName('repo').setDescription('örn: discordjs/discord.js').setRequired(true)),
        async execute(i) { await runBilgi(i, 'github', i.options.getString('repo')); }
    },
    {
        data: new SlashCommandBuilder().setName('npm').setDescription('npm paket bilgisi getirir.')
            .addStringOption(o => o.setName('paket').setDescription('Paket adı').setRequired(true)),
        async execute(i) { await runBilgi(i, 'npm', i.options.getString('paket')); }
    },
    {
        data: new SlashCommandBuilder().setName('qr').setDescription('Metinden QR kod üretir.')
            .addStringOption(o => o.setName('metin').setDescription('QR içeriği').setRequired(true).setMaxLength(500)),
        async execute(i) {
            const { MessageFlags } = require('discord.js');
            const { buildModBResponse } = require('../../utils/uiBuilder');
            await i.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const metin = i.options.getString('metin');
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(metin)}`;
            const payload = buildModBResponse({ title: 'QR Kod', textLines: [`\`${metin.slice(0, 200)}\``], images: [url] });
            await i.editReply(payload);
        }
    }
];
