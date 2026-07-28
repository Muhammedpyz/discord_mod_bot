const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
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
        .setName('mute')
        .setDescription('Kullaniciyi metin kanallarinda susturur (Orn: 10m, 1h, 1d)')
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
                return interaction.reply({ content: 'Gecerli bir kullanici belirtilmedi.', flags: MessageFlags.Ephemeral });
            }

            const durationMinutes = parseDuration(durationStr);
            if (!durationMinutes) {
                return interaction.reply({ content: 'Gecersiz sure formati. Ornek kullanim: 10m, 1h, 1d.', flags: MessageFlags.Ephemeral });
            }
            if (durationMinutes > 40320) { // 28 days
                return interaction.reply({ content: 'Susturma suresi en fazla 28 gun olabilir.', flags: MessageFlags.Ephemeral });
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

                try {
                    await targetMember.timeout(durationMs, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);
                } catch (e) {
                    return interaction.reply({ content: `Zaman asimi islemi uygulanamadi. Hata: ${e.message}`, flags: MessageFlags.Ephemeral });
                }

                const [configRows] = await conn.query('SELECT text_mute_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                if (configRows.length > 0 && configRows[0].text_mute_role_id) {
                    const muteRoleId = configRows[0].text_mute_role_id;
                    try {
                        await targetMember.roles.add(muteRoleId);
                    } catch (e) {
                        console.error("Mute rolu verilemedi:", e);
                    }
                }

                const expiresAt = new Date(Date.now() + durationMs);
                await conn.query(
                    'INSERT INTO mutes (guild_id, user_id, action_type, expires_at, reason) VALUES (?, ?, ?, ?, ?)',
                    [interaction.guild.id, targetUser.id, 'text_mute', expiresAt, reason]
                );

                try {
                    const dmPayload = createContainerMessage(
                        'Sunucuda Susturuldunuz',
                        `**${interaction.guild.name}** sunucusunda metin kanallarinda gecici olarak susturuldunuz.\n\n**Yetkili:** <@${interaction.user.id}>\n**Sure:** ${durationStr}\n**Sebep:** ${reason}`,
                        '#FF8800'
                    );
                    await targetUser.send(dmPayload);
                } catch (dmError) {
                    console.log(`Kullaniciya bildirim gonderilemedi: ${targetUser.id}`);
                }

                const warnResult = await issueWarning(interaction.guild, targetUser, interaction.user.id, `Susturma (${durationStr}): ${reason}`);

                let extraMsg = '';
                if (warnResult && warnResult.success) {
                    extraMsg = `\nAyrica sistem tarafindan 1 uyari eklendi. (Toplam Aktif: ${warnResult.totalWarns})`;
                }

                const payload = createContainerMessage(
                    `${EMOJIS.warning} Kullanici Susturuldu`,
                    `<@${targetUser.id}> adli kullaniciya **${durationStr}** sureyle zaman asimi uygulandi.\n**Sebep:** ${reason}${extraMsg}`,
                    '#FF8800'
                );
                
                await interaction.reply(payload);

                const logPayload = createContainerMessage(
                    `${EMOJIS.warning} Kullanici Susturuldu`,
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
            console.error('Mute hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
