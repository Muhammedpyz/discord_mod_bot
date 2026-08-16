const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ototepki')
        .setDescription('Belirlenen kanallara atılan her mesaja otomatik emoji tepkisi ekler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('ekle')
                .setDescription('Bir kanala otomatik tepki ekler.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Tepki eklenecek kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('emojiler')
                        .setDescription('Mesajlara eklenecek emojiler (Örn: <:mono:id> veya özel emoji IDleri)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Bir kanalın otomatik tepki ayarını kaldırır.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Ayarı silinecek kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Sunucudaki tüm otomatik tepki kanallarını listeler.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'ekle') {
            const channel = interaction.options.getChannel('kanal');
            const emojis = interaction.options.getString('emojiler');

            await db.addAutoReactChannel(guildId, channel.id, emojis);

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Otomatik Tepki Ayarlandı`,
                `<#${channel.id}> kanalına gönderilen tüm yeni mesajlara otomatik olarak belirlenen emojiler eklenecektir.\n\n**Belirlenen Emojiler:** ${emojis}`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'sil') {
            const channel = interaction.options.getChannel('kanal');
            const removed = await db.removeAutoReactChannel(guildId, channel.id);

            if (!removed) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`,
                    `<#${channel.id}> için ayarlanmış bir otomatik tepki bulunmuyor.`,
                    '#ED4245', [], [], false
                ));
            }

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Otomatik Tepki Kaldırıldı`,
                `<#${channel.id}> kanalının otomatik tepki ayarı silindi.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'liste') {
            const list = await db.getAutoReactChannels(guildId);
            if (list.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Ayar Bulunamadı`,
                    'Sunucuda ayarlanmış herhangi bir otomatik tepki kanalı bulunmuyor.',
                    '#5865F2', [], [], false
                ));
            }

            const items = list.map(item => `• <#${item.channel_id}> ➔ ${item.emojis}`).join('\n');
            const title = `<:mono:${MONO_EMOJIS.disc || '1537767765103083541'}> Otomatik Tepki Kanalları`;
            const desc = `Mesaj atıldığında otomatik emoji eklenen kanallar:`;
            const fields = [
                { name: 'Kanal ve Emojiler', value: items, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }
    }
};
