const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');
const { validateModTarget } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('softban')
        .setDescription('Kullanıcıyı softbanlar (Banlayıp hemen açar, mesajlarını siler).')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Softbanlanacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Softban sebebi')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const targetUser = interaction.options.getUser('kullanici');
            const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (member) {
                const validation = await validateModTarget(interaction.member, member);
                if (!validation.success) {
                    const errPayload = createContainerMessage(`${EMOJIS.cross} Hata`, validation.message, '#2B2D31');
                    return interaction.editReply(errPayload);
                }
            }

            await interaction.guild.members.ban(targetUser.id, { 
                deleteMessageSeconds: 604800, 
                reason: reason 
            });

            await interaction.guild.members.unban(targetUser.id, 'Softban tamamlandı');

            const payload = createContainerMessage(
                `${EMOJIS.kick} Kullanıcı Softbanlandı`,
                `<@${targetUser.id}> adlı kullanıcı başarıyla softbanlandı. Son 7 günlük mesajları silindi.`,
                '#2B2D31'
            );
            await interaction.editReply(payload);

            const logPayload = createContainerMessage(
                'Kullanıcı Softbanlandı',
                '',
                '#2B2D31',
                [],
                [
                    { name: 'Kullanıcı', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: reason, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);
            
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
