const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { COLORS, buildModAPanel, buildModBResponse } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('karantina-ayarla')
        .setDescription('Sunucudaki tüm kanalları tarayarak Banlı Rolüne görünmesini engeller.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query('SELECT banned_role_id, ticket_category_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
            
            if (rows.length === 0 || !rows[0].banned_role_id) {
                const errPayload = buildModBResponse({
                    title: 'Hata',
                    textLines: ['Sunucu için Banlı Rolü ayarlanmamış. Lütfen önce `/kurulum` veya `/ayarlar` komutu ile banlı rolünü ayarlayın.'],
                    color: COLORS.ERROR
                });
                return interaction.editReply(errPayload);
            }

            const bannedRoleId = rows[0].banned_role_id;
            const ticketCategoryId = rows[0].ticket_category_id;

            let updatedCount = 0;
            let skippedCount = 0;

            const channels = await interaction.guild.channels.fetch();

            for (const [id, channel] of channels) {
                if (!channel) continue;

                // Ticket kategorisi ve altındaki kanalları atla
                if (ticketCategoryId && (id === ticketCategoryId || channel.parentId === ticketCategoryId)) {
                    skippedCount++;
                    
                    // Ticket kategorisine Banlı rolü için ViewChannel: true verebiliriz, eğer kapalıysa
                    try {
                        await channel.permissionOverwrites.edit(bannedRoleId, { ViewChannel: true });
                    } catch (e) {}
                    
                    continue;
                }

                // Diğer kanallarda Banlı rolünü ViewChannel: false yap
                try {
                    await channel.permissionOverwrites.edit(bannedRoleId, { ViewChannel: false });
                    updatedCount++;
                } catch (e) {
                    // Yetki eksikliği vs. olabilir
                }
            }

            const payload = buildModBResponse({
                title: 'Karantina Ayarlandı',
                textLines: [
                    `Sunucudaki **${updatedCount}** kanal başarıyla tarandı ve <@&${bannedRoleId}> rolüne gizlendi.`,
                    `Ticket sistemine ait **${skippedCount}** kanal ise karantina dışında bırakıldı.`
                ],
                color: COLORS.SUCCESS
            });

            await interaction.editReply(payload);

        } catch (err) {
            console.error('Karantina ayarla hatası:', err);
            const errPayload = buildModBResponse({
                title: 'Hata',
                textLines: ['İşlem sırasında bir hata oluştu.'],
                color: COLORS.ERROR
            });
            await interaction.editReply(errPayload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
