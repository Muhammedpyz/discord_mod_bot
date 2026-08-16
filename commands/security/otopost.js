const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otopost')
        .setDescription('Kanallara otomatik görsel, meme ve içerik akışı sağlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('ekle')
                .setDescription('Belirlenen kanala otomatik içerik akışı başlatır.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('İçeriklerin gönderileceği metin kanalı')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('kategori')
                        .setDescription('Gönderilecek içerik kategorisi')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Mizah & Memes (Komik Gönderiler)', value: 'memes' },
                            { name: 'Anime & Manga Görselleri', value: 'anime' },
                            { name: 'HD Duvar Kağıtları (Wallpapers)', value: 'wallpaper' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Bir kanaldaki otomatik içerik akışını durdurur.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Akışı durdurulacak kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('kategori')
                        .setDescription('Durdurulacak içerik kategorisi')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Mizah & Memes', value: 'memes' },
                            { name: 'Anime & Manga', value: 'anime' },
                            { name: 'HD Duvar Kağıtları', value: 'wallpaper' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Sunucudaki aktif otomatik içerik kanallarını listeler.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'ekle') {
            const channel = interaction.options.getChannel('kanal');
            const category = interaction.options.getString('kategori');

            await db.addAutoPostConfig(guildId, channel.id, category);

            const catTr = {
                'memes': 'Mizah & Memes',
                'anime': 'Anime Görselleri',
                'wallpaper': 'HD Duvar Kağıtları'
            }[category];

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Otomatik Akış Başlatıldı`,
                `<#${channel.id}> kanalına periyodik olarak yeni ve güncel **${catTr}** gönderilecektir.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'sil') {
            const channel = interaction.options.getChannel('kanal');
            const category = interaction.options.getString('kategori');

            const removed = await db.removeAutoPostConfig(guildId, channel.id, category);
            if (!removed) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`,
                    `<#${channel.id}> kanalında bu kategori için aktif bir otomatik akış bulunamadı.`,
                    '#ED4245', [], [], false
                ));
            }

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Otomatik Akış Durduruldu`,
                `<#${channel.id}> kanalındaki içerik akışı başarıyla sonlandırıldı.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'liste') {
            const allConfigs = await db.getAutoPostConfigs();
            const guildConfigs = allConfigs.filter(c => c.guild_id === guildId);

            if (guildConfigs.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Akış Bulunamadı`,
                    'Bu sunucuda ayarlanmış herhangi bir otomatik içerik akışı bulunmuyor.',
                    '#5865F2', [], [], false
                ));
            }

            const items = guildConfigs.map(c => `• <#${c.channel_id}> ➔ \`${c.feed_type.toUpperCase()}\``).join('\n');
            const title = `<:mono:${MONO_EMOJIS.image || '1537767789098307615'}> Aktif İçerik Akışları`;
            const desc = `Belirli aralıklarla içerik gönderilen kanallar:`;
            const fields = [
                { name: 'Kanal ve Akış Türü', value: items, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }
    }
};
