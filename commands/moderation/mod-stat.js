'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod-stat')
        .setDescription('Sunucudaki yetkililerin moderasyon işlemlerini ve performansını sıralar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(opt =>
            opt.setName('zaman')
               .setDescription('Filtrelenecek zaman aralığı')
               .setRequired(false)
               .addChoices(
                   { name: 'Tüm Zamanlar (Varsayılan)', value: 'all' },
                   { name: 'Son 24 Saat', value: '24h' },
                   { name: 'Son 7 Gün (Bu Hafta)', value: '7d' },
                   { name: 'Son 30 Gün (Bu Ay)', value: '30d' }
               )
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const timeFilter = interaction.options.getString('zaman') || 'all';

        let dateClause = '';
        let timeTitle = 'Tüm Zamanlar';
        if (timeFilter === '24h') {
            dateClause = 'AND created_at >= NOW() - INTERVAL 1 DAY';
            timeTitle = 'Son 24 Saat';
        } else if (timeFilter === '7d') {
            dateClause = 'AND created_at >= NOW() - INTERVAL 7 DAY';
            timeTitle = 'Son 7 Gün (Bu Hafta)';
        } else if (timeFilter === '30d') {
            dateClause = 'AND created_at >= NOW() - INTERVAL 30 DAY';
            timeTitle = 'Son 30 Gün (Bu Ay)';
        }

        let conn;
        try {
            conn = await pool.getConnection();
            
            // 1. Uyarılar (Warnings)
            const warnRows = await conn.query(`
                SELECT moderator_id as user_id, COUNT(*) as count 
                FROM warnings 
                WHERE guild_id = ? AND moderator_id IS NOT NULL AND moderator_id != '' ${dateClause}
                GROUP BY moderator_id
            `, [interaction.guild.id]);

            // 2. Cezalar & Susturmalar (Mutes, Bans, Kicks)
            const muteRows = await conn.query(`
                SELECT moderator_id as user_id, action_type, COUNT(*) as count 
                FROM mutes 
                WHERE guild_id = ? AND moderator_id IS NOT NULL AND moderator_id != '' ${dateClause}
                GROUP BY moderator_id, action_type
            `, [interaction.guild.id]);

            // 3. Kapatılan Destek Biletleri (Tickets)
            const ticketDateClause = dateClause.replace(/created_at/g, 'closed_at');
            const ticketRows = await conn.query(`
                SELECT closed_by as user_id, COUNT(*) as count 
                FROM tickets 
                WHERE guild_id = ? AND closed_by IS NOT NULL AND closed_by != '' ${ticketDateClause}
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
                const emptyMsg = createContainerMessage(
                    `Yetkili Performans Tablosu (${timeTitle})`,
                    `Belirtilen zaman aralığında (${timeTitle}) kaydedilmiş herhangi bir moderasyon işlemi bulunamadı.`,
                    COLORS.PRIMARY || '#5865F2'
                );
                emptyMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                return interaction.editReply(emptyMsg);
            }

            let rank = 1;
            const rankBadges = [
                `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}>`,
                `<:mono:${MONO_EMOJIS.medal || '1537767798472704032'}>`,
                `<:mono:${MONO_EMOJIS.award || '1537767883608957048'}>`
            ];

            const lines = [];
            for (const [userId, data] of sortedMods) {
                const badge = rankBadges[rank - 1] || `**[#${rank}]**`;
                lines.push([
                    `${badge} <@${userId}> — Toplam İşlem: **${data.total}**`,
                    `> • Uyarı: \`${data.warns}\` | Susturma: \`${data.mutes}\` | Ban: \`${data.bans}\` | Bilet: \`${data.tickets}\``
                ].join('\n'));
                rank++;
            }

            const desc = [
                `**Zaman Filtresi:** \`${timeTitle}\``,
                ``,
                lines.join('\n\n'),
                ``,
                `*Detaylı moderasyon işlemleri sunucu denetim kayıtları ve log sisteminden anlık hesaplanmaktadır.*`
            ].join('\n');

            const payload = createContainerMessage(
                `Yetkili Liderlik Tablosu (${timeTitle})`,
                desc,
                COLORS.PRIMARY || '#5865F2'
            );
            payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

            await interaction.editReply(payload);
        } catch (error) {
            console.error('[Mod-stat error]:', error);
            const errPayload = createContainerMessage(
                'Hata',
                'Sorgu sırasında bir veritabanı hatası oluştu.',
                COLORS.ERROR || '#ED4245'
            );
            errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.editReply(errPayload);
        } finally {
            if (conn) conn.release();
        }
    }
};
