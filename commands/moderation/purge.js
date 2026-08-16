const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Mesajları kriterlere göre filtreleyerek toplu şekilde siler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('botlar')
                .setDescription('Kanalda yalnızca botların attığı mesajları siler.')
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Taranacak mesaj sayısı (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('insanlar')
                .setDescription('Kanalda yalnızca gerçek kullanıcıların attığı mesajları siler.')
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Taranacak mesaj sayısı (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('linkler')
                .setDescription('Kanalda yalnızca link/URL içeren mesajları siler.')
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Taranacak mesaj sayısı (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('ekler')
                .setDescription('Kanalda yalnızca görsel, video ve dosya eki içeren mesajları siler.')
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Taranacak mesaj sayısı (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('kullanici')
                .setDescription('Kanalda yalnızca belirli bir üyenin mesajlarını siler.')
                .addUserOption(opt =>
                    opt.setName('hedef')
                        .setDescription('Mesajları silinecek kullanıcı')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Taranacak mesaj sayısı (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('kelime')
                .setDescription('Kanalda belirli bir kelimeyi içeren mesajları siler.')
                .addStringOption(opt =>
                    opt.setName('aranan_kelime')
                        .setDescription('İçeriğinde aranacak kelime veya metin')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Taranacak mesaj sayısı (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('miktar');
        const channel = interaction.channel;

        const fetched = await channel.messages.fetch({ limit: amount }).catch(() => null);
        if (!fetched || fetched.size === 0) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Mesaj Bulunamadı`,
                'Kanalda taranacak mesaj bulunamadı.',
                '#5865F2', [], [], false
            ));
        }

        let toDelete = [];

        if (sub === 'botlar') {
            toDelete = fetched.filter(m => m.author.bot);
        } else if (sub === 'insanlar') {
            toDelete = fetched.filter(m => !m.author.bot);
        } else if (sub === 'linkler') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            toDelete = fetched.filter(m => urlRegex.test(m.content));
        } else if (sub === 'ekler') {
            toDelete = fetched.filter(m => m.attachments.size > 0 || m.embeds.length > 0);
        } else if (sub === 'kullanici') {
            const target = interaction.options.getUser('hedef');
            toDelete = fetched.filter(m => m.author.id === target.id);
        } else if (sub === 'kelime') {
            const word = interaction.options.getString('aranan_kelime').toLowerCase();
            toDelete = fetched.filter(m => m.content && m.content.toLowerCase().includes(word));
        }

        if (toDelete.size === 0 && Array.isArray(toDelete) && toDelete.length === 0) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Eşleşen Mesaj Yok`,
                'Belirttiğiniz filtreye uyan herhangi bir mesaj bulunamadı.',
                '#5865F2', [], [], false
            ));
        }

        const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
        const count = deleted ? deleted.size : (toDelete.size || toDelete.length);

        const subNames = {
            'botlar': 'Bot Mesajları',
            'insanlar': 'Kullanıcı Mesajları',
            'linkler': 'Bağlantı/Link İçeren Mesajlar',
            'ekler': 'Görsel & Ek İçeren Mesajlar',
            'kullanici': 'Kullanıcıya Özel Mesajlar',
            'kelime': 'Kelime Filtreli Mesajlar'
        };

        const title = `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Filtreli Temizlik Tamamlandı`;
        const desc = `<#${channel.id}> kanalında **${count}** adet mesaj başarıyla silindi.`;
        const fields = [
            { name: 'Uygulanan Filtre', value: `\`${subNames[sub] || sub}\``, inline: true },
            { name: 'Taranan / Silinen', value: `\`${amount}\` / \`${count}\``, inline: true }
        ];

        return interaction.editReply(createContainerMessage(title, desc, '#57F287', [], fields, false));
    }
};
