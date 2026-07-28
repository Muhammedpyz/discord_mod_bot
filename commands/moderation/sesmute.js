const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { validateModTarget } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');
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
        .setName('sesmute')
        .setDescription('Kullaniciyi ses kanallarinda susturur (Orn: 10m, 1h, 1d)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Susturulacak kullanici')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sure')
                .setDescription('Sure (Orn: 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Susturma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const durationStr = interaction.options.getString('sure');
            const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

            if (!targetUser) {
                return interaction.reply({ content: 'Lutfen gecerli bir kullanici belirtiniz.', flags: MessageFlags.Ephemeral });
            }

            const durationMinutes = parseDuration(durationStr);
            if (!durationMinutes) {
                return interaction.reply({ content: 'Gecersiz sure formati. Ornek kullanim: 10m, 1h, 1d.', flags: MessageFlags.Ephemeral });
            }
            
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.reply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            if (!targetMember.moderatable && targetUser.id !== interaction.client.user.id) {
                return interaction.reply({ content: 'Bu kullaniciyi susturma yetkim bulunmuyor. Rol hiyerarsisini kontrol ediniz.', flags: MessageFlags.Ephemeral });
            }

            const durationMs = durationMinutes * 60 * 1000;
            
            let conn;
            try {
                conn = await pool.getConnection();

                if (!targetMember.voice.channel) {
                    return interaction.reply({ content: 'Kullanici su anda herhangi bir ses kanalinda degil. Sadece ses kanalindaki kullanicilara sesli susturma isleme alinabilir.', flags: MessageFlags.Ephemeral });
                }

                try {
                    await targetMember.voice.setMute(true, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);
                    await targetMember.voice.setDeaf(true, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);
                } catch (e) {
                    return interaction.reply({ content: `Sesli kanalda susturulma gerceklestirilemedi. Bot yetkilerini kontrol ediniz. Hata: ${e.message}`, flags: MessageFlags.Ephemeral });
                }

                const [configRows] = await conn.query('SELECT voice_mute_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                if (configRows.length > 0 && configRows[0].voice_mute_role_id) {
                    const muteRoleId = configRows[0].voice_mute_role_id;
                    try {
                        await targetMember.roles.add(muteRoleId);
                    } catch (e) {
                        console.error("Ses mute rolu verilemedi:", e);
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
                        '#FF8800'
                    );
                    await targetUser.send(dmPayload);
                } catch (dmError) {
                    console.log(`Kullaniciya bildirim gonderilemedi: ${targetUser.id}`);
                }

                const warnResult = await issueWarning(interaction.guild, targetUser, interaction.user.id, `Sesli Susturma (${durationStr}): ${reason}`);

                let extraMsg = '';
                if (warnResult && warnResult.success) {
                    extraMsg = `\nSistem tarafindan 1 uyari eklendi. (Toplam Aktif: ${warnResult.totalWarns})`;
                }

                const payload = createContainerMessage(
                    'Kullanici Ses Kanallarinda Susturuldu',
                    `<@${targetUser.id}> adli kullanici **${durationStr}** sureyle ses kanallarinda sagirlastirildi ve susturuldu.\n**Sebep:** ${reason}${extraMsg}`,
                    '#3498DB'
                );
                
                await interaction.reply(payload);

                const logPayload = createContainerMessage(
                    'Kullanici Susturuldu (Voice)',
                    '',
                    '#FF8800',
                    [],
                    [
                        { name: 'Susturulan Uye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Sebep', value: reason, inline: false },
                        { name: 'Sure', value: durationStr, inline: true }
                    ]
                );
                
                await sendLog(interaction.guild, logPayload);

            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error('Sesmute hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
