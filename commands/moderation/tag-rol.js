const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tag-rol')
        .setDescription('Kullanıcı adında belirten tag bulunduğunda otomatik verilecek rolü ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Tag sistemini aktif eder.')
                .addStringOption(option => option.setName('tag').setDescription('Tag metni (örn: TL)').setRequired(true))
                .addRoleOption(option => option.setName('rol').setDescription('Verilecek rol').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Tag sistemini kapatır.')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            const subcommand = interaction.options.getSubcommand();
            conn = await pool.getConnection();

            if (subcommand === 'ayarla') {
                const tagText = interaction.options.getString('tag');
                const role = interaction.options.getRole('rol');

                await conn.query(
                    'INSERT INTO tag_role (guild_id, tag_text, role_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tag_text = ?, role_id = ?',
                    [interaction.guild.id, tagText, role.id, tagText, role.id]
                );

                const payload = createContainerMessage(
                    `${EMOJIS.shield} Tag-Rol Ayarlandı`,
                    `Kullanıcı adında **${tagText}** bulunanlara ${role} rolü verilecek.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Tag-Rol Ayarlandı',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Tag', value: tagText, inline: true },
                        { name: 'Rol', value: `${role}`, inline: true },
                        { name: 'Yetkili', value: `${interaction.user}`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);

            } else if (subcommand === 'kapat') {
                await conn.query('DELETE FROM tag_role WHERE guild_id = ?', [interaction.guild.id]);

                const payload = createContainerMessage(
                    `${EMOJIS.check} Tag-Rol Kapatıldı`,
                    `Tag rol sistemi başarıyla kapatıldı.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Tag-Rol Kapatıldı',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Yetkili', value: `${interaction.user}`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);
            }

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
