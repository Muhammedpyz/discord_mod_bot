const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('medya-kanali')
        .setDescription('Sadece resim, video ve dosya paylaşımına izin verilen kanalları yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('ekle')
                .setDescription('Bir kanalı sadece medya kanalı olarak ayarlar.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Medya kanalı yapılacak metin kanalı')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Bir kanalı medya kanalı listesinden çıkarır.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Çıkarılacak kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Sunucudaki tüm sadece-medya kanallarını listeler.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'ekle') {
            const channel = interaction.options.getChannel('kanal');
            await db.addMediaChannel(guildId, channel.id);

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Medya Kanalı Eklendi`,
                `<#${channel.id}> kanalı artık **Sadece Medya** kanalıdır. Bu kanala resim/video/dosya içermeyen düz metin mesajları atıldığında otomatik olarak silinecektir.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'sil') {
            const channel = interaction.options.getChannel('kanal');
            const removed = await db.removeMediaChannel(guildId, channel.id);

            if (!removed) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`,
                    `<#${channel.id}> zaten medya kanalı listesinde bulunmuyor.`,
                    '#ED4245', [], [], false
                ));
            }

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Medya Kanalı Kaldırıldı`,
                `<#${channel.id}> medya kanalı listesinden çıkarıldı. Artık normal sohbet mesajları yazılabilir.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'liste') {
            const channels = await db.getMediaChannels(guildId);
            if (channels.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Medya Kanalı Yok`,
                    'Sunucuda ayarlanmış herhangi bir sadece-medya kanalı bulunmuyor.',
                    '#5865F2', [], [], false
                ));
            }

            const channelList = channels.map(c => `• <#${c}> (\`${c}\`)`).join('\n');
            const title = `<:mono:${MONO_EMOJIS.image || '1537767789098307615'}> Sadece Medya Kanalları`;
            const desc = `Aşağıdaki kanallarda düz metin yazışması engellenir, yalnızca görsel/video paylaşımına izin verilir:`;
            const fields = [
                { name: 'Aktif Kanallar', value: channelList, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }
    }
};
