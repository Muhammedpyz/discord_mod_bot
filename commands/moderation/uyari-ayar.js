const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyari-ayar')
        .setDescription('Uyarı limitlerinde otomatik ceza ayarlarını yapılandırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Belirli bir uyarı sayısı için ceza ayarlar.')
                .addIntegerOption(option => 
                    option.setName('uyari_sayisi')
                        .setDescription('Uyarı sayısı (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10))
                .addStringOption(option =>
                    option.setName('ceza')
                        .setDescription('Uygulanacak ceza')
                        .setRequired(true)
                        .addChoices(
                            { name: '10 Dakika Mute', value: 'mute_10m' },
                            { name: '1 Saat Mute', value: 'mute_1h' },
                            { name: '1 Gün Mute', value: 'mute_1d' },
                            { name: 'Sunucudan At (Kick)', value: 'kick' },
                            { name: 'Sunucudan Yasakla (Ban)', value: 'ban' }
                        ))
                .addStringOption(option =>
                    option.setName('sure')
                        .setDescription('Mute için saniye cinsinden özel süre (Opsiyonel)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Mevcut uyarı ayarlarını listeler.')),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        let conn;
        
        try {
            conn = await pool.getConnection();

            if (subcommand === 'ayarla') {
                const warnCount = interaction.options.getInteger('uyari_sayisi');
                const action = interaction.options.getString('ceza');
                let durationStr = interaction.options.getString('sure');
                let duration = 0;
                
                if (durationStr && !isNaN(durationStr)) {
                    duration = parseInt(durationStr);
                }

                await conn.query(
                    `INSERT INTO warn_actions (guild_id, warn_count, action, duration) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE action = VALUES(action), duration = VALUES(duration)`,
                    [interaction.guild.id, warnCount, action, duration]
                );

                const payload = createContainerMessage(
                    `${EMOJIS.settings} Uyarı Ayarı Kaydedildi`,
                    `${warnCount} uyarı alan kullanıcılar için ceza **${action}** olarak ayarlandı.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            } 
            else if (subcommand === 'liste') {
                const rows = await conn.query(
                    'SELECT warn_count, action, duration FROM warn_actions WHERE guild_id = ? ORDER BY warn_count ASC',
                    [interaction.guild.id]
                );

                if (rows.length === 0) {
                    const emptyPayload = createContainerMessage(
                        `${EMOJIS.warning} Uyarı Ayarları`,
                        'Henüz yapılandırılmış bir uyarı cezası bulunmuyor.',
                        '#2B2D31'
                    );
                    return interaction.editReply(emptyPayload);
                }

                let listText = '';
                for (const row of rows) {
                    let extra = '';
                    if (row.duration > 0) extra = ` (${row.duration} saniye)`;
                    listText += `**${row.warn_count} Uyarı:** ${row.action}${extra}\n`;
                }

                const payload = createContainerMessage(
                    `${EMOJIS.settings} Uyarı Ayarları Listesi`,
                    listText,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            }

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
