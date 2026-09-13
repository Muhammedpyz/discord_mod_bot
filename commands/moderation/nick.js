const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription('Üyenin görünen adını değiştirir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
        .addStringOption(o => o.setName('isim').setDescription('Yeni isim (boş bırakılırsa sıfırlanır)').setRequired(false).setMaxLength(32)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getMember('uye');
        const isim = interaction.options.getString('isim');
        if (!uye) {
            return interaction.editReply(createContainerMessage('Hata', 'Üye bulunamadı.', '#ED4245', [], [], false, true));
        }
        await uye.setNickname(isim || null, `${interaction.user.tag}`).catch(() => {});
        await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> ismi **${isim || 'sıfırlandı'}** olarak ayarlandı.`, '#57F287', [], [], false, true));
    }
};
