const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Message, createContainerMessage, COLORS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { createSorguMenu } = require('../../utils/sorguHelpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sorgu')
        .setDescription('Kullanici hakkinda detayli bilgi ve gecmis sorgulama paneli.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Sorgulanacak kullanici').setRequired(true)),

    async execute(interaction) {
        // Check permissions
        if (!interaction.member.permissions.has('ModerateMembers')) {
            const errPayload = require('../../utils/uiBuilder').buildModBResponse({
                title: 'Yetkisiz Islem',
                textLines: ['Bu komutu kullanmak icin Uyeleri Yonet yetkisine sahip olmalisiniz.'],
                color: COLORS.ERROR
            });
            return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser('kullanici');
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch {
            targetMember = null;
        }

        let conn;
        try {
            conn = await pool.getConnection();

            // Gather stats
            const [warnRows] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUser.id])
            ]);
            const activeWarns = Number(warnRows[0]?.cnt || 0);

            const [totalWarnRows] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id])
            ]);
            const totalWarns = Number(totalWarnRows[0]?.cnt || 0);

            const [muteRows] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id])
            ]);
            const totalMutes = Number(muteRows[0]?.cnt || 0);

            const [ticketRows] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND owner_id = ?', [interaction.guild.id, targetUser.id])
            ]);
            const totalTickets = Number(ticketRows[0]?.cnt || 0);

            // Build overview
            const roles = targetMember ? targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .join(', ') || 'Rol yok' : 'Sunucuda degil';

            const joinDate = targetMember?.joinedTimestamp
                ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`
                : 'Bilinmiyor';

            const createDate = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`;

            const rawFields = [
                { name: 'Roller', value: roles.length > 200 ? roles.substring(0, 200) + '...' : roles },
                { name: 'Istatistikler', value: `Aktif Uyari: **${activeWarns}** | Toplam Uyari: **${totalWarns}**\nToplam Susturma: **${totalMutes}** | Toplam Ticket: **${totalTickets}**` }
            ];

            const actionRows = [];

            const { buildModAPanel } = require('../../utils/uiBuilder');
            const payload = buildModAPanel({
                title: 'Kullanici Sorgu Paneli',
                description: `**Kullanici:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\`\n**Hesap Olusturma:** ${createDate}\n**Sunucuya Katilim:** ${joinDate}\n\n` + rawFields.map(f => `**${f.name}:**\n${f.value}`).join('\n\n'),
                navRow: createSorguMenu(targetUser.id, 'sorgu_overview'),
                actionRows,
                showSocials: true
            });

            await interaction.editReply(payload);
        } catch (err) {
            console.error('[Sorgu] Hata:', err);
            const { buildModBResponse } = require('../../utils/uiBuilder');
            const errPayload = buildModBResponse({
                title: 'Sistem Hatasi',
                textLines: ['Sorgu sirasinda bir hata olustu. Lutfen tekrar deneyin.'],
                color: COLORS.ERROR
            });
            await interaction.editReply(errPayload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
