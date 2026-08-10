const { SlashCommandBuilder, ActionRowBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, COLORS, buildModAPanel, buildModBResponse } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { createSorguMenu } = require('../../utils/sorguHelpers');
const { AuditLogEvent } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sorgu')
        .setDescription('Kullanıcı veya Yetkili hakkında detayli bilgi ve gecmis sorgulama paneli.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.BanMembers | PermissionFlagsBits.ManageRoles)
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Sorgulanacak kullanıcı veya yetkili').setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) && 
            !interaction.member.permissions.has(PermissionFlagsBits.BanMembers) && 
            !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) && 
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const errPayload = buildModBResponse({
                title: 'Yetkisiz İşlem',
                textLines: ['Bu komutu kullanmak için ilgili moderasyon yetkilerine sahip olmalisiniz.'],
                color: COLORS.ERROR
            });
            return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let conn;

        try {
            conn = await pool.getConnection();

            const targetUser = interaction.options.getUser('kullanıcı');
            let targetMember;
            try { targetMember = await interaction.guild.members.fetch(targetUser.id); } catch { targetMember = null; }

            // 1. Normal Kullanıcı Istatistikleri (Ceza Geçmişi vs.)
            const [warnRows] = await conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUser.id]);
            const activeWarns = Number(warnRows[0]?.cnt || 0);

            const [totalWarnRows] = await conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
            const totalWarns = Number(totalWarnRows[0]?.cnt || 0);

            const [muteRows] = await conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
            const totalMutes = Number(muteRows[0]?.cnt || 0);

            const [ticketRows] = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND owner_id = ?', [interaction.guild.id, targetUser.id]);
            const totalTickets = Number(ticketRows[0]?.cnt || 0);

            const roles = targetMember ? targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .join(', ') || 'Rol yok' : 'Sunucuda değil';

            const joinDate = targetMember?.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>` : 'Bilinmiyor';
            const createDate = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`;

            const { MONO_EMOJIS } = require('../../utils/uiBuilder');

            const rawFields = [
                { name: `<:mono:${MONO_EMOJIS.shield}> Roller`, value: roles.length > 200 ? roles.substring(0, 200) + '...' : roles },
                { name: `<:mono:${MONO_EMOJIS.warning}> Ceza Istatistikleri`, value: `Aktif Uyarı: **${activeWarns}** | Toplam Uyarı: **${totalWarns}**\nToplam Susturulma: **${totalMutes}** | Toplam Ticket: **${totalTickets}**` }
            ];

            // 2. Eğer hedef kullanıcı YETKİLİ ise, yetkili işlem gecmisini de getir!
            let isTargetStaff = false;
            if (targetMember && (
                targetMember.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                targetMember.permissions.has(PermissionFlagsBits.BanMembers) ||
                targetMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
                targetMember.permissions.has(PermissionFlagsBits.Administrator)
            )) {
                isTargetStaff = true;
            }

            let staffDesc = '';
            if (isTargetStaff) {
                const [staffWarnRows] = await conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetUser.id]);
                const totalWarnsGiven = Number(staffWarnRows[0]?.cnt || 0);

                const [delRows] = await conn.query('SELECT COUNT(*) as cnt FROM deleted_messages WHERE guild_id = ? AND deleted_by = ?', [interaction.guild.id, targetUser.id]);
                const totalDels = Number(delRows[0]?.cnt || 0);

                const [staffTicketRows] = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetUser.id]);
                const totalTicketsClosed = Number(staffTicketRows[0]?.cnt || 0);

                let totalBans = 0, totalKicks = 0, totalTimeouts = 0, totalRoles = 0, auditWarns = 0;
                
                try {
                    const modRows = await conn.query('SELECT action_type, COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND moderator_id = ? GROUP BY action_type', [interaction.guild.id, targetUser.id]);
                    modRows.forEach(row => {
                        if (row.action_type === 'ban') totalBans += Number(row.cnt);
                        else if (row.action_type === 'kick') totalKicks += Number(row.cnt);
                        else if (row.action_type === 'text_mute') totalTimeouts += Number(row.cnt);
                    });
                } catch(e) {
                    console.error('sorgu.js db mod actions fetch error:', e);
                }

                try {
                    const logs = await interaction.guild.fetchAuditLogs({ limit: 100, user: targetUser.id });
                    logs.entries.forEach(e => {
                        if (e.action === AuditLogEvent.MemberRoleUpdate) {
                            const addedRoles = e.changes?.find(c => c.key === '$add')?.new?.map(r => r.name).join(', ');
                            if (addedRoles) {
                                totalRoles++;
                            }
                        }
                    });
                } catch (e) {
                    console.error('sorgu.js Audit log hatası:', e);
                } 
                
                staffDesc = `**<:mono:${MONO_EMOJIS.crown}> Moderasyon Özeti:**\n`;
                staffDesc += `└ Toplam İşlem: **${totalWarnsGiven + totalDels + totalTicketsClosed + totalBans + totalKicks + totalTimeouts + totalRoles}**\n`;
                staffDesc += `└ Atılan Uyarı: **${totalWarnsGiven}**\n`;
                staffDesc += `└ Kapatılan Bilet: **${totalTicketsClosed}**\n`;
                staffDesc += `└ Atılan Ban: **${totalBans}** | Kick: **${totalKicks}** | Mute: **${totalTimeouts}**\n`;
                staffDesc += `└ Silinen Mesaj (Clear): **${totalDels}**\n`;

                rawFields.push({ name: `<:mono:${MONO_EMOJIS.settings}> Yetkili Geçmişi (Sicil)`, value: staffDesc });
            }

            const payload = createContainerMessage(
                'Kullanıcı Sorgu Paneli',
                `Aşağıda <@${targetUser.id}> adlı kullanıcının detaylı sicil bilgilerine ulaşabilirsiniz.\n\n**Kayıt Tarihi:** ${createDate}\n**Sunucuya Katılım:** ${joinDate}`,
                isTargetStaff ? '#3498DB' : '#2ECC71',
                [createSorguMenu(targetUser.id, 'sorgu_overview', isTargetStaff)],
                rawFields
            );

            await interaction.editReply(payload);
        } catch (err) {
            console.error('[Sorgu] Hata:', err);
            const errPayload = buildModBResponse({
                title: 'Sistem Hatasi',
                textLines: ['Sorgu sırasında bir hata oluştu. Lütfen tekrar deneyin.'],
                color: COLORS.ERROR
            });
            await interaction.editReply(errPayload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
