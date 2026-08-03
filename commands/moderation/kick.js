const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { validateModTarget } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('at')
        .setDescription('Kullanıcıyı sunucudan atar.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Atilacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Atilma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('kullanıcı');
            const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.reply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            if (!targetMember.kickable) {
                return interaction.reply({ content: 'Bu kullanıcıyı sunucudan atma yetkim bulunmuyor. Rol hiyerarşisini kontrol ediniz.', flags: MessageFlags.Ephemeral });
            }

            try {
                const dmPayload = createContainerMessage('Sunucudan Atildiniz', `**${interaction.guild.name}** sunucusundan atildiniz.\n**Sebep:** ${reason}`, '#FF5500');
                await targetUser.send(dmPayload);
            } catch (dmError) {
                console.log('Kullanıcıya bildirim gönderilemedi.');
            }

            await targetMember.kick(`Moderator: ${interaction.user.tag} | Sebep: ${reason}`);

            let conn;
            try {
                conn = await pool.getConnection();
                await conn.query(
                    'INSERT INTO mutes (guild_id, user_id, moderator_id, action_type, expires_at, reason) VALUES (?, ?, ?, ?, NULL, ?)',
                    [interaction.guild.id, targetUser.id, interaction.user.id, 'kick', reason]
                );
            } catch(e) {
                console.error('Kick DB log hatası:', e);
            } finally {
                if (conn) conn.release();
            }

            const payload = createContainerMessage(`${EMOJIS.kick} Kullanıcı Sunucudan Atildi`, `<@${targetUser.id}> sunucudan atildi.\n**Sebep:** ${reason}`, '#FF5500');
            await interaction.reply(payload);

            const logPayload = createContainerMessage(
                `${EMOJIS.cross} Kullanıcı Atildi`,
                '',
                '#FF5500',
                [],
                [
                    { name: 'Atilan Üye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                ]
            );
            
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Kick hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Kullanıcı atilirken sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Kullanıcı atilirken sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
