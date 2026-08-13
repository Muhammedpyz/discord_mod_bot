const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol')
        .setDescription('Kullanıcıya rol verir veya alır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Kullanıcıya rol verir.')
                .addUserOption(option => option.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
                .addRoleOption(option => option.setName('rol').setDescription('Verilecek rol').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('al')
                .setDescription('Kullanıcıdan rol alır.')
                .addUserOption(option => option.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
                .addRoleOption(option => option.setName('rol').setDescription('Alınacak rol').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const subcommand = interaction.options.getSubcommand();
            const targetMember = interaction.options.getMember('kullanici');
            const role = interaction.options.getRole('rol');

            if (!targetMember) {
                return interaction.editReply({ content: 'Kullanıcı bulunamadı.' });
            }

            // Check hierarchy
            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            if (botMember.roles.highest.position <= role.position) {
                return interaction.editReply({ content: 'Bu rol benim en yüksek rolümden daha üstte veya aynı sırada, bu yüzden bu rolü veremem/alamam.' });
            }

            if (interaction.user.id !== interaction.guild.ownerId) {
                if (interaction.member.roles.highest.position <= role.position) {
                    return interaction.editReply({ content: 'Bu rol sizin en yüksek rolünüzden daha üstte veya aynı sırada.' });
                }
            }

            let islemStr = '';
            if (subcommand === 'ver') {
                await targetMember.roles.add(role);
                islemStr = 'Verildi';
                const payload = createContainerMessage(
                    `${EMOJIS.check} Rol Verildi`,
                    `${targetMember} kullanıcısına ${role} rolü verildi.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            } else if (subcommand === 'al') {
                await targetMember.roles.remove(role);
                islemStr = 'Alındı';
                const payload = createContainerMessage(
                    `${EMOJIS.check} Rol Alındı`,
                    `${targetMember} kullanıcısından ${role} rolü alındı.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            }

            const logPayload = createContainerMessage(
                'Rol İşlemi',
                '',
                '#2B2D31',
                [],
                [
                    { name: 'Kullanıcı', value: `${targetMember}`, inline: true },
                    { name: 'Rol', value: `${role}`, inline: true },
                    { name: 'İşlem', value: islemStr, inline: true },
                    { name: 'Yetkili', value: `${interaction.user}`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
