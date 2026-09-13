const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol-al')
        .setDescription('Üyeden rol alır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
        .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getMember('uye');
        const rol = interaction.options.getRole('rol');
        if (!uye) {
            return interaction.editReply(createContainerMessage('Hata', 'Üye sunucuda bulunamadı.', '#ED4245', [], [], false, true));
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const exTop = interaction.member.roles.highest;
            const botTop = interaction.guild.members.me.roles.highest;
            if (exTop.position <= rol.position || botTop.position <= rol.position) {
                return interaction.editReply(createContainerMessage('Yetki Yok', 'Rol sıran veya botun sırası yetersiz.', '#ED4245', [], [], false, true));
            }
        }
        await uye.roles.remove(rol, `${interaction.user.tag} aldı`).catch(() => {});
        await interaction.editReply(createContainerMessage('Rol Alındı', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> üyesinden <@&${rol.id}> alındı.`, '#57F287', [], [], false, true));
    }
};
