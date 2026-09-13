const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toplu-rol')
        .setDescription('Sunucudaki herkese rol ver/al (onaylı).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices(
            { name: 'Herkese Ver', value: 'ver' },
            { name: 'Herkesten Al', value: 'kaldir' }
        ))
        .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const islem = interaction.options.getString('islem');
        const rol = interaction.options.getRole('rol');
        if (rol.managed || rol.id === interaction.guild.id) {
            return interaction.editReply(createContainerMessage('Hata', 'Bu rol toplu işlem için uygun değil.', '#ED4245', [], [], false, true));
        }
        const botTop = interaction.guild.members.me.roles.highest;
        if (botTop.position <= rol.position) {
            return interaction.editReply(createContainerMessage('Yetki Yok', 'Botun rolü hedeften üstte olmalı.', '#ED4245', [], [], false, true));
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`toplu_onay_${islem}_${rol.id}`).setLabel('Onayla').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.check),
            new ButtonBuilder().setCustomId('toplu_iptal').setLabel('İptal').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross)
        );
        await interaction.editReply(createContainerMessage('Toplu Rol Onayı', `<@&${rol.id}> rolü **${islem === 'ver' ? 'HERKESE verilecek' : 'HERKESTEN alınacak'}**.\n\nBu işlem geri alınamaz toplu değişiklik yapar. Emin misin?`, '#FEE75C', [row]));
    }
};
