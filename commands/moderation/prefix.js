const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Sunucuya özel prefix (ön ek) ayarlarını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Yeni bir prefix ekler.')
                .addStringOption(option =>
                    option.setName('prefix')
                        .setDescription('Eklenecek prefix (Maksimum 3 karakter)')
                        .setRequired(true)
                        .setMaxLength(3)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Ayarlanmış prefixleri listeler.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Bir prefixi siler.')
                .addStringOption(option =>
                    option.setName('prefix')
                        .setDescription('Silinecek prefix')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        let conn;

        try {
            conn = await pool.getConnection();

            if (subcommand === 'ayarla') {
                const prefix = interaction.options.getString('prefix');
                
                // Check if already 5 prefixes exist
                const rows = await conn.query('SELECT COUNT(*) as count FROM guild_prefixes WHERE guild_id = ?', [interaction.guild.id]);
                const count = Number(rows[0].count);

                if (count >= 5) {
                    const payload = createContainerMessage(
                        `${EMOJIS.cross} İşlem Başarısız`,
                        `Bu sunucu için maksimum prefix sınırına (5) ulaşıldı.`,
                        '#ED4245'
                    );
                    return await interaction.editReply(payload);
                }

                try {
                    await conn.query('INSERT INTO guild_prefixes (guild_id, prefix) VALUES (?, ?)', [interaction.guild.id, prefix]);
                    
                    const payload = createContainerMessage(
                        `${EMOJIS.settings} Prefix Eklendi`,
                        `\`${prefix}\` başarıyla sunucu prefixleri arasına eklendi.`,
                        '#2B2D31'
                    );
                    await interaction.editReply(payload);

                    const logPayload = createContainerMessage(
                        'Prefix Eklendi',
                        '',
                        '#2B2D31',
                        [],
                        [
                            { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Eklenen Prefix', value: `\`${prefix}\``, inline: true }
                        ]
                    );
                    await sendLog(interaction.guild, logPayload);
                } catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        const payload = createContainerMessage(
                            `${EMOJIS.cross} İşlem Başarısız`,
                            `\`${prefix}\` zaten bu sunucu için ayarlanmış.`,
                            '#ED4245'
                        );
                        return await interaction.editReply(payload);
                    }
                    throw err;
                }
            } else if (subcommand === 'liste') {
                const rows = await conn.query('SELECT prefix FROM guild_prefixes WHERE guild_id = ?', [interaction.guild.id]);
                
                if (rows.length === 0) {
                    const payload = createContainerMessage(
                        `${EMOJIS.settings} Prefix Listesi`,
                        `Bu sunucu için ayarlanmış özel bir prefix bulunmuyor.`,
                        '#2B2D31'
                    );
                    return await interaction.editReply(payload);
                }

                const prefixList = rows.map(r => `\`${r.prefix}\``).join(', ');
                const payload = createContainerMessage(
                    `${EMOJIS.settings} Prefix Listesi`,
                    `Mevcut prefixler:\n${prefixList}`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

            } else if (subcommand === 'sil') {
                const prefix = interaction.options.getString('prefix');
                const result = await conn.query('DELETE FROM guild_prefixes WHERE guild_id = ? AND prefix = ?', [interaction.guild.id, prefix]);
                
                if (result.affectedRows > 0) {
                    const payload = createContainerMessage(
                        `${EMOJIS.check} Prefix Silindi`,
                        `\`${prefix}\` başarıyla sunucu prefixleri arasından kaldırıldı.`,
                        '#2B2D31'
                    );
                    await interaction.editReply(payload);

                    const logPayload = createContainerMessage(
                        'Prefix Silindi',
                        '',
                        '#2B2D31',
                        [],
                        [
                            { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Silinen Prefix', value: `\`${prefix}\``, inline: true }
                        ]
                    );
                    await sendLog(interaction.guild, logPayload);
                } else {
                    const payload = createContainerMessage(
                        `${EMOJIS.cross} İşlem Başarısız`,
                        `\`${prefix}\` isimli bir prefix bulunamadı.`,
                        '#ED4245'
                    );
                    await interaction.editReply(payload);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
