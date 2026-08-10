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

            // Banlı rolünün sunucu genelindeki tüm yetkilerini (Administrator vs.) tamamen sıfırla
            try {
                const roleObj = interaction.guild.roles.cache.get(bannedRoleId) || await interaction.guild.roles.fetch(bannedRoleId);
                if (roleObj) {
                    await roleObj.setPermissions([]);
                }
            } catch (e) {
                console.log("Rol yetkileri sıfırlanırken hata:", e);
            }

            let updatedCount = 0;
            let skippedCount = 0;

            const channels = await interaction.guild.channels.fetch();

            for (const [id, channel] of channels) {
                if (!channel) continue;

                // Ticket kategorisi ve altındaki kanalları atla
                if (ticketCategoryId && (id === ticketCategoryId || channel.parentId === ticketCategoryId)) {
                    skippedCount++;
                    
                    // Ticket sistemi herkes tarafından (özellikle banlılar tarafından) görülebilmeli
                    try {
                        await channel.permissionOverwrites.edit(bannedRoleId, { ViewChannel: true });
                    } catch (e) {}
                    
                    continue;
                }

                // Diğer tüm kanallarda Banlı rolünü ve Everyone rolünü ViewChannel: false yap (Özel Kanal)
                try {
                    await channel.permissionOverwrites.edit(bannedRoleId, { ViewChannel: false });
                    await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                    updatedCount++;
                } catch (e) {
                    // Yetki eksikliği vs. olabilir
                }
            }

            const payload = buildModBResponse({
                title: 'Karantina Ayarlandı',
                textLines: [
                    `Sunucudaki **${updatedCount}** kanal başarıyla **Özel Kanal** yapıldı (@everyone'a gizlendi) ve <@&${bannedRoleId}> rolü tamamen mühürlendi.`,
                    `Banlı Rolünün sunucu genelindeki tüm yönetici vb. yetkileri sıfırlandı.`,
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
