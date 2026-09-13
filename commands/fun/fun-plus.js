const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const ROASTS = [
    'Senin fikirlerin Wi-Fi gibi: var gibi görünüp bir türlü bağlanmıyor.',
    'Ayna seni görünce parlaklığını kısıyor.',
    'Beynin uçak modunda kalmış, indirmeyi unutmuşsun.',
    'Sen istisnasın: kurallar bile senin için çalışmıyor.',
    'Google bile seni aramaktan vazgeçti.',
    'Şarjın %1 ama hala konuşuyorsun, helal.',
    'Senin esprilerin diyet yemek gibi: kimse doymuyor.',
    'Zekan o kadar yüksek ki bulutların üstünde... görünmüyor.',
    'Sen tam bir hata mesajısın: kimse anlamıyor ama herkes görüyor.',
    'Kahve bile seni ayıltamadıysa sorun büyük.',
    'Seninle satranç oynamak isterdim ama taşları yerdin.',
    'Profil fotoğrafın bile seni tanımıyor.'
];

const FACTS = [
    'Bal insanlık tarihinin bozulmayan tek gıdasıdır.',
    'Ahtapotların 3 kalbi vardır.',
    'Muzlar radyoaktiftir (çok az miktarda).',
    'Denizatları tek eşlidir ve kuyruklarıyla tutunurlar.',
    'Kelebekler ayaklarıyla tat alır.',
    'Venüs\'te bir gün, bir yıldan uzundur.',
    'Su aygırlarının teri doğal güneş kremidir.',
    'Baykuşların gözleri oynamaz, boyunlarını çevirirler.',
    'Karıncalar uyumaz, dinlenir.',
    'Zürafalar günde sadece 30 dakika uyur.',
    'Aslanlar günde 20 saate kadar uyuyabilir.',
    'Penguenler eşlerine çakıl taşı hediye eder.',
    'Arılar birbirleriyle dans ederek konuşur.',
    'Filler kendilerini aynada tanıyabilir.',
    'Köpekbalıkları kansere yakalanmaz sanılırdı ama bu bir efsanedir.'
];

const ZONES = [
    ['İstanbul', 'Europe/Istanbul'], ['Londra', 'Europe/London'], ['Berlin', 'Europe/Berlin'],
    ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'], ['Tokyo', 'Asia/Tokyo'],
    ['Dubai', 'Asia/Dubai'], ['Moskova', 'Europe/Moscow'], ['Paris', 'Europe/Paris']
];

module.exports = [
    {
        data: new SlashCommandBuilder().setName('sataş').setDescription('Etiketlenen kişiye dostça sataşır.')
            .addUserOption(o => o.setName('hedef').setDescription('Hedef').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const hedef = interaction.options.getUser('hedef');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`roast_${hedef.id}`).setLabel('Bir Daha').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            const { funCard } = require('../../utils/gifHandler');
            const ROASTS2 = ['Sen tam bir hata mesajısın: kimse anlamıyor ama herkes görüyor.', 'Zekan o kadar yüksek ki bulutların üstünde... görünmüyor.', 'Seninle satranç oynamak isterdim ama taşları yerdin.'];
            const payload = await funCard('Sataşma', [`<@${hedef.id}>, ${ROASTS2[Math.floor(Math.random() * ROASTS2.length)]}`, '', '-# Şaka amaçlıdır, sevgiler!'], [row], 'slap');
            await interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
        }
    },
    {
        data: new SlashCommandBuilder().setName('hack').setDescription('Arkadaşını şakayla hackle (rol yapma).')
            .addUserOption(o => o.setName('hedef').setDescription('Hedef').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const hedef = interaction.options.getUser('hedef');
            const adimlar = [
                `Bağlanılıyor: ${hedef.username}...`,
                'Güvenlik duvarı aşılıyor...',
                'Şifreler çözülüyor...',
                'Dosyalar indiriliyor...',
                `Tamamlandı! ${hedef.username} hacklendi. (Şaka şaka, kimse hacklenmedi!)`
            ];
            for (let i = 0; i < adimlar.length; i++) {
                const bar = '█'.repeat(i + 1) + '░'.repeat(adimlar.length - i - 1);
                await interaction.editReply(createContainerMessage('Hack Simülasyonu', `\`${bar}\`\n\n${adimlar[i]}`, '#ED4245')).catch(() => {});
                if (i < adimlar.length - 1) await new Promise(r => setTimeout(r, 1200));
            }
        }
    },
    {
        data: new SlashCommandBuilder().setName('ilginç-bilgi').setDescription('Rastgele ilginç bilgi verir.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('fact_yeni').setLabel('Yeni Bilgi').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            await interaction.editReply(createContainerMessage('İlginç Bilgi', FACTS[Math.floor(Math.random() * FACTS.length)], '#5865F2', [row]));
        }
    },
    {
        data: new SlashCommandBuilder().setName('dünya-saati').setDescription('Büyük şehirlerde saat kaç gösterir.'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            let body = '';
            for (const [ad, tz] of ZONES) {
                try {
                    const saat = new Date().toLocaleTimeString('tr-TR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
                    body += `**${ad}:** ${saat}\n`;
                } catch {}
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('saat_yenile').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            await interaction.editReply(createContainerMessage('Dünya Saati', body, '#5865F2', [row]));
        }
    },
    {
        data: new SlashCommandBuilder().setName('ters-çevir').setDescription('Yazıyı tersten yazar.')
            .addStringOption(o => o.setName('metin').setDescription('Metin').setRequired(true).setMaxLength(500)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const metin = interaction.options.getString('metin');
            await interaction.editReply(createContainerMessage('Ters Çevirme', `\`${[...metin].reverse().join('')}\``, '#5865F2'));
        }
    }
];
