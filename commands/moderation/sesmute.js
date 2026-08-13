const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { validateModTarget } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');
const { saveRolesAndApplyMute } = require('../../utils/roleMemory');
const { issueWarning } = require('../../utils/warningManager');

function parseDuration(str) {
    const match = str.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'm') return val;
    if (unit === 'h') return val * 60;
    if (unit === 'd') return val * 60 * 24;
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vmute')
        .setDescription('Bir kullanıcıyı ses kanallarında susturur.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Susturulacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('süre')
                .setDescription('Sure (Örn: 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Susturma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const targetUser = interaction.options.getUser('kullanıcı');
            const durationStr = interaction.options.getString('süre');
            const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

            if (!targetUser) {
                return interaction.editReply({ content: 'Lütfen geçerli bir kullanıcı belirtiniz.', flags: MessageFlags.Ephemeral });
            }

            const durationMinutes = parseDuration(durationStr);
            if (!durationMinutes) {
                return interaction.editReply({ content: 'Gecersiz sure formati. Ornek kullanim: 10m, 1h, 1d.', flags: MessageFlags.Ephemeral });
            }
            
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.editReply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            if (!targetMember.moderatable && targetUser.id !== interaction.client.user.id) {
                return interaction.editReply({ content: 'Bu kullanıcıyı susturma yetkim bulunmuyor. Rol hiyerarşisini kontrol ediniz.', flags: MessageFlags.Ephemeral });
            }

            const durationMs = durationMinutes * 60 * 1000;
            
            let conn;
            try {
                conn = await pool.getConnection();

                if (targetMember.voice.channel) {
                    try {
                        await targetMember.voice.setMute(true, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);
                        await targetMember.voice.setDeaf(true, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);
                    } catch (e) {
                        console.error(`Sesli kanalda susturulma gerceklestirilemedi. Hata: ${e.message}`);
                    }
                }

                const configRows = await conn.query('SELECT voice_mute_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                if (configRows && configRows.length > 0 && configRows[0].voice_mute_role_id) {
                    await saveRolesAndApplyMute(targetMember, 'voice_mute');
                    
                    const muteRoleId = configRows[0].voice_mute_role_id;
                    try {
                        await targetMember.roles.add(muteRoleId, 'Ses Susturma İşlemi');
                    } catch (e) {
                        console.error("Ses mute rolü verilemedi:", e);
                    }
                }

                const expiresAt = new Date(Date.now() + durationMs);
                await conn.query(
                    'INSERT INTO mutes (guild_id, user_id, action_type, expires_at, reason) VALUES (?, ?, ?, ?, ?)',
                    [interaction.guild.id, targetUser.id, 'voice_mute', expiresAt, reason]
                );

                try {
                    const dmPayload = createContainerMessage(
                        'Ses Kanallarinda Susturuldunuz',
                        `**${interaction.guild.name}** sunucusunda ses kanallarinda sagirlastirildiniz ve susturuldunuz.\n\n**Yetkili:** <@${interaction.user.id}>\n**Sure:** ${durationStr}\n**Sebep:** ${reason}`,
                        '#2B2D31'
                    );
                    await targetUser.send(dmPayload);
                } catch (dmError) {
                    console.log(`Kullanıcıya bildirim gönderilemedi: ${targetUser.id}`);
                }

                const warnResult = await issueWarning(interaction.guild, targetUser, interaction.user.id, `Sesli Susturma (${durationStr}): ${reason}`);

                let extraMsg = '';
                if (warnResult && warnResult.success) {
                    extraMsg = `\nSistem tarafından 1 uyarı eklendi. (Toplam Aktif: ${warnResult.totalWarns})`;
                }

                const payload = createContainerMessage(
                    'Kullanıcı Ses Kanallarinda Susturuldu',
                    `<@${targetUser.id}> adlı kullanıcı **${durationStr}** süreyle ses kanallarinda sagirlastirildi ve susturuldu.\n**Sebep:** ${reason}${extraMsg}`,
                    '#2B2D31'
                );
                
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Kullanıcı Susturuldu (Voice)',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Susturulan Üye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Sebep', value: reason, inline: false },
                        { name: 'Sure', value: durationStr, inline: true }
                    ]
                );
                
                await sendLog(interaction.guild, logPayload, 'voice');

            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error('Sesmute hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.editReply({ content: 'Sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
