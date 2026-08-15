const { SlashCommandBuilder } = require('discord.js');
const { pool } = require('../../db');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('davet-sıralama')
        .setDescription('Sunucudaki en çok davet yapan kullanıcıların liderlik tablosunu gösterir.'),

    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guild.id;

        let conn;
        try {
            conn = await pool.getConnection();

            // Fetch top 10 inviters with active members
            const rows = await conn.query(`
                SELECT 
                    it.inviter_id, 
                    COUNT(CASE WHEN it.has_left = FALSE AND it.is_fake = FALSE THEN 1 END) + COALESCE(bi.bonus_amount, 0) as total_valid,
                    COUNT(CASE WHEN it.has_left = FALSE AND it.is_fake = FALSE THEN 1 END) as regular_count,
                    COUNT(CASE WHEN it.has_left = TRUE THEN 1 END) as left_count,
                    COALESCE(bi.bonus_amount, 0) as bonus_count
                FROM invite_tracking it
                LEFT JOIN bonus_invites bi ON bi.guild_id = it.guild_id AND bi.user_id = it.inviter_id
                WHERE it.guild_id = ? AND it.inviter_id != 'BİLİNMİYOR' AND it.inviter_id != 'VANITY'
                GROUP BY it.inviter_id
                HAVING total_valid > 0
                ORDER BY total_valid DESC
                LIMIT 10
            `, [guildId]);

            const eTrophy = getMonoEmoji('trophy');

            if (!rows || rows.length === 0) {
                const emptyPayload = buildModBResponse({
                    title: `${eTrophy} Davet Sıralaması`,
                    thumbnail: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
                    textLines: [
                        'Sunucuda henüz kaydedilmiş geçerli bir davet bulunmuyor.',
                        '---SEPARATOR---',
                        '-# Sayılar bot kapalıyken gelenleri ve özel (vanity) davet linkini kapsamaz.'
                    ]
                });
                return await interaction.editReply(emptyPayload);
            }

            const listLines = [];
            
            for (let index = 0; index < rows.length; index++) {
                const row = rows[index];
                const rank = index + 1;
                const total = Number(row.total_valid || 0);
                const reg = Number(row.regular_count || 0);
                const left = Number(row.left_count || 0);
                const bonus = Number(row.bonus_count || 0);

                if (rank === 1) {
                    listLines.push(`🥇 **1. Sıra** › <@${row.inviter_id}>\n» **${total}** Davet (${reg} aktif · ${left} ayrılan${bonus > 0 ? ` · ${bonus} bonus` : ''})`);
                } else if (rank === 2) {
                    listLines.push(`🥈 **2. Sıra** › <@${row.inviter_id}>\n» **${total}** Davet (${reg} aktif · ${left} ayrılan)`);
                } else if (rank === 3) {
                    listLines.push(`🥉 **3. Sıra** › <@${row.inviter_id}>\n» **${total}** Davet (${reg} aktif · ${left} ayrılan)`);
                } else {
                    listLines.push(`**#${rank}** › <@${row.inviter_id}> — **${total}** Davet (${reg} aktif)`);
                }
            }

            const payload = buildModBResponse({
                title: `${eTrophy} Sunucu Davet Sıralaması:`,
                thumbnail: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
                textLines: [
                    ...listLines,
                    '---SEPARATOR---',
                    '-# Sayılar bot kapalıyken gelenleri ve özel (vanity) davet linkini kapsamaz.'
                ]
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Davet sıralaması hatası:', error);
            await interaction.editReply({ content: 'Sıralama yüklenirken bir hata oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    }
};
