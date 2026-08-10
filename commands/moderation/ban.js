const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../../utils/uiBuilder'); // Fixed to uiBuilder if COLORS is exported there, wait, prompt says utils/uiBuilder.js has COLORS.
const { createContainerMessage, createV2Message, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { validateModTarget } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yasakla')
        .setDescription('Kullanıcıyı sunucudan yasaklar.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Yasaklanacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('kullanıcı');
            const reason = interaction.options.getString('sebep') || 'Belirtilmedi';


            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.reply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            try {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Yasaga Itiraz Et')
                        .setURL('https://forms.gle/ornek-itiraz-formu-linki') 
                        .setStyle(ButtonStyle.Link)
                );

                const dmPayload = createContainerMessage(
                    'Sunucudan Yasaklandiniz', 
                    `**${interaction.guild.name}** sunucusunda yasaklandınız.\n**Sebep:** ${reason}\n\nEger bu yasağın haksız olduğunu düşünüyorsanız aşağıdaki butona tıklayarak itiraz formunu doldurabilirsiniz.`,
                    '#313338',
                    [row]
                );

                await targetUser.send(dmPayload);
            } catch (dmError) {
                console.log('Kullanıcıya DM gönderilemedi.');
            }

            let conn;
            try {
                conn = await pool.getConnection();
                const [configRows] = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                
                if (configRows.length === 0 || !configRows[0].banned_role_id) {
                    return interaction.reply({ content: 'Sunucu için "Banlisin" rolü ayarlanmamis. Lütfen ayarları kontrol edin.', flags: MessageFlags.Ephemeral });
                }

                const bannedRoleId = configRows[0].banned_role_id;
                
                if (!targetMember) {
                    return interaction.reply({ content: 'Kullanıcı sunucuda bulunamadı. Rol bani atılabilmesi için kullanıcının sunucuda olması gerekir.', flags: MessageFlags.Ephemeral });
                }

                const rolesToKeep = targetMember.roles.cache
                    .filter(r => !r.editable || r.id === interaction.guild.id)
                    .map(r => r.id);
                
                const rolesToSave = targetMember.roles.cache
                    .filter(r => r.editable && r.id !== interaction.guild.id && r.id !== bannedRoleId)
                    .map(r => r.id);

                if (!rolesToKeep.includes(bannedRoleId)) {
                    rolesToKeep.push(bannedRoleId);
                }
                
                await targetMember.roles.set(rolesToKeep, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);

                if (rolesToSave.length > 0) {
                    const values = rolesToSave.map(rId => [targetUser.id, interaction.guild.id, rId]);
                    await conn.query('INSERT IGNORE INTO user_roles (user_id, guild_id, role_id) VALUES ?', [values]);
                }

                await conn.query(
                    'INSERT INTO mutes (guild_id, user_id, moderator_id, action_type, expires_at, reason) VALUES (?, ?, ?, ?, NULL, ?)',
                    [interaction.guild.id, targetUser.id, interaction.user.id, 'ban', reason]
                );

                const payload = createContainerMessage(
                    `${EMOJIS.ban} Kullanıcı Yasaklandı`,
                    `<@${targetUser.id}> adlı kullanıcıya yasaklı rolü verildi ve diğer rolleri alındı.\n**Sebep:** ${reason}`,
                    '#313338'
                );
                
                await interaction.reply(payload);

                const logPayload = createContainerMessage(
                    'Kullanıcı Yasaklandı',
                    '',
                    '#313338',
                    [],
                    [
                        { name: 'Yasaklanan Üye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Sebep', value: reason, inline: false }
                    ]
                );
                
                await sendLog(interaction.guild, logPayload);
            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error('Ban hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
