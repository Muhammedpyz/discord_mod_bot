const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLog } = require('../../utils/logger');
const { validateModTarget } = require('../../utils/permissions');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Kullanicinin susturmasini kaldirir.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Susturmasi kaldirilacak kullanici')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const targetUser = interaction.options.getUser('user');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return interaction.editReply({ content: 'Kullanici sunucuda bulunamadi.' });
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
                'Susturma Kaldirildi',
                '',
                '#00FF00',
                [],
                [
                    { name: 'Kullanici', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
                ]
            );

            await sendLog(interaction.guild, logPayload);

            return interaction.editReply({ content: `${targetUser.tag} kullanicisinin susturmasi basariyla kaldirildi.` });

        } catch (error) {
            console.error('Unmute hatasi:', error);
            return interaction.editReply({ content: 'Islem sirasinda sistemsel bir hata olustu.' });
        }
    }
};
