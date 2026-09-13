const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kanal-kilit')
        .setDescription('Metin kanalını kilitler veya açar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o.setName('durum').setDescription('Durum').setRequired(true).addChoices(
            { name: 'Kilitle', value: 'kilit' },
            { name: 'Aç', value: 'ac' }
        ))
        .addChannelOption(o => o.setName('kanal').setDescription('Kanal (boşsa burası)').setRequired(false).addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const kanal = interaction.options.getChannel('kanal') || interaction.channel;
        const durum = interaction.options.getString('durum');
        try {
            await kanal.permissionOverwrites.edit(interaction.guild.id, { SendMessages: durum === 'ac' ? null : false });
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <#${kanal.id}> ${durum === 'ac' ? 'açıldı' : 'kilitlendi'}.`, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[KanalKilit]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız (bot yetkisini kontrol et).', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
