const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLog } = require('../../utils/logger');
const { validateModTarget } = require('../../utils/permissions');
const { pool } = require('../../db');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('susturma-kaldır')
        .setDescription('Kullanıcının susturmasını kaldirir.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Susturması kaldırılacak kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const targetUser = interaction.options.getUser('kullanıcı');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return interaction.editReply({ content: 'Kullanıcı sunucuda bulunamadı.' });
            }

            const configRows = await pool.query('SELECT text_mute_role_id, voice_mute_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
            const config = configRows[0];

            const validation = validateModTarget(interaction, targetUser, targetMember);
            if (!validation.valid) {
                return interaction.editReply({ content: validation.reason });
            }

            const rolesToRemove = [];
            if (config && config.text_mute_role_id && targetMember.roles.cache.has(config.text_mute_role_id)) {
                rolesToRemove.push(config.text_mute_role_id);
            }
            if (config && config.voice_mute_role_id && targetMember.roles.cache.has(config.voice_mute_role_id)) {
                rolesToRemove.push(config.voice_mute_role_id);
            }

            if (rolesToRemove.length > 0) {
                await targetMember.roles.remove(rolesToRemove);
            }

            if (targetMember.communicationDisabledUntilTimestamp) {
                await targetMember.timeout(null);
            }

            await pool.query('UPDATE mutes SET is_active = FALSE WHERE user_id = ? AND guild_id = ? AND is_active = TRUE', [targetUser.id, interaction.guild.id]);

            const logPayload = createContainerMessage(
                `${EMOJIS.unlock} Susturma Kaldırıldı`,
                '',
                '#00FF00',
                [],
                [
                    { name: 'Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
                ]
            );

            await sendLog(interaction.guild, logPayload);

            const successPayload = createContainerMessage(
                `${EMOJIS.unlock} Başarılı`,
                `**<@${targetUser.id}>** adlı kullanıcının susturması başarıyla kaldırıldı.`,
                '#00FF00'
            );
            return interaction.editReply(successPayload);

        } catch (error) {
            console.error('Unmute hatası:', error);
            return interaction.editReply({ content: 'İşlem sırasında sistemsel bir hata oluştu.' });
        }
    }
};
