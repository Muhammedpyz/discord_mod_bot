const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

function hierarchyOk(executor, botMember, rol) {
    // Yönetici her şeyi yapar; yoksa iki tarafın da en yüksek rolü hedeften üstte olmalı
    if (executor.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const exTop = executor.roles.highest;
    const botTop = botMember.roles.highest;
    return exTop.position > rol.position && botTop.position > rol.position;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol-ver')
        .setDescription('Üyeye rol verir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
        .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getMember('uye');
        const rol = interaction.options.getRole('rol');
        if (!uye || uye.user.bot) {
            return interaction.editReply(createContainerMessage('Hata', 'Geçerli bir üye etiketle.', '#ED4245', [], [], false, true));
        }
        if (rol.managed || rol.id === interaction.guild.id) {
            return interaction.editReply(createContainerMessage('Hata', 'Bu rol verilemez (bot/özel rol).', '#ED4245', [], [], false, true));
        }
        if (!hierarchyOk(interaction.member, interaction.guild.members.me, rol)) {
            return interaction.editReply(createContainerMessage('Yetki Yok', 'Rol sıran veya botun sırası yetersiz.', '#ED4245', [], [], false, true));
        }
        await uye.roles.add(rol, `${interaction.user.tag} verdi`).catch(() => {});
        await interaction.editReply(createContainerMessage('Rol Verildi', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> üyesine <@&${rol.id}> verildi.`, '#57F287', [], [], false, true));
    }
};
