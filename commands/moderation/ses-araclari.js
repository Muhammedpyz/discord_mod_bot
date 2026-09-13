const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

async function needVoice(interaction, member, what) {
    if (!member || !member.voice.channel) {
        await interaction.editReply(createContainerMessage('Hata', `${what} için önce bir ses kanalında olmalısın.`, '#ED4245', [], [], false, true));
        return null;
    }
    return member.voice.channel;
}

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('ses-git')
            .setDescription('Etiketlenen üyenin ses kanalına gidersin.')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getMember('uye');
            if (!uye?.voice.channel) {
                return interaction.editReply(createContainerMessage('Hata', 'Hedef üye seste değil.', '#ED4245', [], [], false, true));
            }
            const benim = await needVoice(interaction, interaction.member, 'Gitmek');
            if (!benim) return;
            await interaction.member.voice.setChannel(uye.voice.channel).catch(() => {});
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> üyesinin yanına gittin.`, '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ses-getir')
            .setDescription('Üyeyi bulunduğun ses kanalına getirirsin.')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getMember('uye');
            if (!uye?.voice.channel) {
                return interaction.editReply(createContainerMessage('Hata', 'Hedef üye seste değil.', '#ED4245', [], [], false, true));
            }
            const benim = await needVoice(interaction, interaction.member, 'Getirmek');
            if (!benim) return;
            await uye.voice.setChannel(benim).catch(() => {});
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> yanına getirildi.`, '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('sesten-kes')
            .setDescription('Üyenin ses bağlantısını kesersin.')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getMember('uye');
            if (!uye?.voice.channel) {
                return interaction.editReply(createContainerMessage('Hata', 'Üye zaten seste değil.', '#ED4245', [], [], false, true));
            }
            await uye.voice.disconnect('Yetkili kesti').catch(() => {});
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> sesten atıldı.`, '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ses-limit')
            .setDescription('Ses kanalı kullanıcı limitini ayarlar.')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
            .addIntegerOption(o => o.setName('limit').setDescription('Limit (0 = sınırsız)').setRequired(true).setMinValue(0).setMaxValue(99)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const kanal = interaction.options.getChannel('kanal');
            const limit = interaction.options.getInteger('limit');
            await kanal.setUserLimit(limit).catch(() => {});
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <#${kanal.id}> limiti **${limit === 0 ? 'sınırsız' : limit}** oldu.`, '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ses-isim')
            .setDescription('Ses kanalının ismini değiştirir.')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
            .addStringOption(o => o.setName('isim').setDescription('Yeni isim').setRequired(true).setMaxLength(100)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const kanal = interaction.options.getChannel('kanal');
            const isim = interaction.options.getString('isim');
            await kanal.setName(isim).catch(() => {});
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> Kanal ismi **${isim}** oldu.`, '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ses-kilit')
            .setDescription('Ses kanalını kilitler/açar.')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
            .addStringOption(o => o.setName('durum').setDescription('Durum').setRequired(true).addChoices(
                { name: 'Kilitle', value: 'kilit' },
                { name: 'Aç', value: 'ac' }
            )),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const kanal = interaction.options.getChannel('kanal');
            const durum = interaction.options.getString('durum');
            await kanal.permissionOverwrites.edit(interaction.guild.id, { Connect: durum === 'ac' ? null : false }).catch(() => {});
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <#${kanal.id}> ${durum === 'ac' ? 'açıldı' : 'kilitlendi'}.`, '#57F287', [], [], false, true));
        }
    }
];
