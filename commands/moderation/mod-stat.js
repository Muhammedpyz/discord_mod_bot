const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod-stat')
        .setDescription('Sunucudaki yetkililerin moderasyon işlemlerini sıralar (Liderlik Tablosu).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let conn;
        try {
            conn = await pool.getConnection();
            
            // Get all mod actions from warnings, mutes, tickets
            const warnRows = await conn.query(`
                SELECT moderator_id as user_id, COUNT(*) as count 
                FROM warnings 
                WHERE guild_id = ? AND moderator_id IS NOT NULL AND moderator_id != ''
                GROUP BY moderator_id
            `, [interaction.guild.id]);

            const muteRows = await conn.query(`
                SELECT moderator_id as user_id, action_type, COUNT(*) as count 
                FROM mutes 
                WHERE guild_id = ? AND moderator_id IS NOT NULL AND moderator_id != ''
                GROUP BY moderator_id, action_type
            `, [interaction.guild.id]);

            const ticketRows = await conn.query(`
                SELECT closed_by as user_id, COUNT(*) as count 
                FROM tickets 
                WHERE guild_id = ? AND closed_by IS NOT NULL AND closed_by != ''
                GROUP BY closed_by
            `, [interaction.guild.id]);

            const stats = {};

            const addStat = (id, type, amount) => {
                if (!stats[id]) stats[id] = { warns: 0, mutes: 0, bans: 0, kicks: 0, tickets: 0, total: 0 };
                stats[id][type] += Number(amount);
                stats[id].total += Number(amount);
            };

            for (const row of warnRows) addStat(row.user_id, 'warns', row.count);
            for (const row of ticketRows) addStat(row.user_id, 'tickets', row.count);
            for (const row of muteRows) {
                if (row.action_type === 'ban') addStat(row.user_id, 'bans', row.count);
                else if (row.action_type === 'kick') addStat(row.user_id, 'kicks', row.count);
                else if (row.action_type === 'text_mute' || row.action_type === 'voice_mute') addStat(row.user_id, 'mutes', row.count);
                else addStat(row.user_id, 'mutes', row.count);
            }

            const sortedMods = Object.entries(stats).sort((a, b) => b[1].total - a[1].total).slice(0, 10);

            if (sortedMods.length === 0) {
                return interaction.editReply({ content: 'Henüz kaydedilmiş bir moderasyon işlemi bulunmuyor.' });
            }

            let description = '';
            let rank = 1;
            for (const [userId, data] of sortedMods) {
                let badge = `**[${rank}]**`;
                if (rank === 1) badge = `<:mono:${MONO_EMOJIS.crown}>`;
                if (rank === 2) badge = `<:mono:${MONO_EMOJIS.shield}>`;
                if (rank === 3) badge = `<:mono:${MONO_EMOJIS.check}>`;

                description += `${badge} <@${userId}> - Toplam İşlem: **${data.total}**\n`;
                description += `└ *Uyarı: ${data.warns} | Susturma: ${data.mutes} | Ban: ${data.bans} | Bilet: ${data.tickets}*\n\n`;
                rank++;
            }

            const payload = createContainerMessage(
                'Yetkili Liderlik Tablosu',
                `Sunucuda en çok moderasyon işlemi yapan ilk 10 yetkili aşağıda listelenmiştir.\n\n${description}`,
                '#FFD700'
            );

            await interaction.editReply(payload);
        } catch (error) {
            console.error("Mod-stat hatası:", error);
            await interaction.editReply({ content: 'Sorgu sırasında bir veritabanı hatası oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    }
};
