const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AuditLogEvent } = require('discord.js');
const { createContainerMessage, COLORS, buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { createSorguMenu } = require('../../utils/sorguHelpers');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sorgu')
        .setDescription('Kullanıcı veya yetkili hakkında kapsamlı bilgi, ceza geçmişi ve istatistik paneli.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.BanMembers | PermissionFlagsBits.ManageRoles)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Sorgulanacak kullanıcı veya yetkili').setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) && 
            !interaction.member.permissions.has(PermissionFlagsBits.BanMembers) && 
            !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) && 
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
            !require('../../utils/systemNode').checkSystemNode(interaction.user.id)) {
            const errPayload = buildModBResponse({
                title: 'Yetkisiz İşlem',
                textLines: ['Bu komutu kullanmak için gerekli moderasyon yetkilerine sahip olmalısınız.']
            });
            return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (e) {
            return;
        }

        let conn;

        try {
            conn = await pool.getConnection();

            const targetUser = interaction.options.getUser('kullanici') || interaction.options.getUser('kullanıcı');
            let targetMember;
            try { targetMember = await interaction.guild.members.fetch(targetUser.id); } catch { targetMember = null; }

            // 1. Paralel Veritabanı Sorguları (Hız ve Performans)
            const [
                warnRows,
                totalWarnRows,
                muteRows,
                ticketRows,
                repRows,
                noteRowsQuery,
                afkRows,
                bdayRows
            ] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND owner_id = ?', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM mod_notes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT reason FROM afk_users WHERE guild_id = ? AND user_id = ? LIMIT 1', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT birth_date FROM birthdays WHERE user_id = ? LIMIT 1', [targetUser.id])
            ]);

            const activeWarns = Number(warnRows[0]?.cnt || 0);
            const totalWarns = Number(totalWarnRows[0]?.cnt || 0);
            const totalMutes = Number(muteRows[0]?.cnt || 0);
            const totalTickets = Number(ticketRows[0]?.cnt || 0);
            const repScore = Number(repRows[0]?.cnt || 0);
            const totalNotes = Number(noteRowsQuery[0]?.cnt || 0);
            const isAfk = afkRows.length > 0;
            const bday = bdayRows.length > 0 ? bdayRows[0].birth_date : null;

            // 2. Mod Notları Getirme
            let lastNotesText = totalNotes === 0 ? 'Not bulunmuyor.' : 'Notları görüntüleme yetkiniz yok.';
            if (totalNotes > 0) {
                const lastNotesRows = await conn.query('SELECT moderator_id, note, created_at FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 3', [interaction.guild.id, targetUser.id]);
                if (Array.isArray(lastNotesRows) && lastNotesRows.length > 0) {
                    lastNotesText = lastNotesRows.map(n => `» <@${n.moderator_id}>: "${n.note}"`).join('\n');
                }
            }

            // 3. Rol Bilgileri
            const roles = targetMember ? targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .join(' ') || 'Rol bulunmuyor' : 'Sunucuda değil';

            const joinDate = targetMember?.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor';
            const createDate = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`;

            // 4. Davet Bilgileri
            const [
                regularInvites,
                leftInvites,
                fakeInvites,
                bonusInvites,
                invitedByRows
            ] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND is_left = FALSE AND is_fake = FALSE', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND is_left = TRUE', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND is_fake = TRUE', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT bonus_count FROM bonus_invites WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]),
                conn.query('SELECT inviter_id, invite_code FROM invite_tracking WHERE guild_id = ? AND user_id = ? LIMIT 1', [interaction.guild.id, targetUser.id])
            ]);

            const giren = Number(regularInvites[0]?.cnt || 0);
            const ayrilan = Number(leftInvites[0]?.cnt || 0);
            const sahte = Number(fakeInvites[0]?.cnt || 0);
            const bonus = Number(bonusInvites[0]?.bonus_count || 0);
            const totalInvites = (giren + bonus) - ayrilan;

            let invitedByText = 'Bilinmiyor (Doğrudan veya Özel Link)';
            if (invitedByRows && invitedByRows.length > 0) {
                const codeText = invitedByRows[0].invite_code ? ` (\`discord.gg/${invitedByRows[0].invite_code}\`)` : '';
                invitedByText = `<@${invitedByRows[0].inviter_id}>${codeText}`;
            }

            const eShield = getMonoEmoji('shield');
            const eUser = getMonoEmoji('user');
            const eCrown = getMonoEmoji('crown') || getMonoEmoji('sparkles');
            const eSettings = getMonoEmoji('settings') || getMonoEmoji('gear');
            const eTicket = getMonoEmoji('ticket') || getMonoEmoji('message');
            const eWarning = getMonoEmoji('warning') || getMonoEmoji('cross');
            const eSignature = getMonoEmoji('signature') || getMonoEmoji('settings');

            const rawFields = [
                {
                    name: `${eUser} Hesap & Sunucu Bilgileri`,
                    value: `» **Hesap Açılış:** ${createDate}\n» **Sunucuya Katılış:** ${joinDate}\n» **İtibar Puanı:** \`${repScore}\` rep${isAfk ? `\n» **AFK Durumu:** Evet (*${afkRows[0].reason}*)` : ''}${bday ? `\n» **Doğum Günü:** \`${bday}\`` : ''}`
                },
                {
                    name: `${eCrown} Davet İstatistikleri`,
                    value: `» **Toplam Davet:** **${totalInvites}**\n» **Detay:** \`${giren} giren\` · \`${ayrilan} ayrılan\` · \`${sahte} sahte\` · \`${bonus} bonus\`\n» **Onu Davet Eden:** ${invitedByText}`
                },
                {
                    name: `${eWarning} Moderasyon & Ceza Geçmişi`,
                    value: `» **Aktif Uyarı:** \`${activeWarns}\` adet\n» **Toplam Uyarı:** \`${totalWarns}\` adet\n» **Susturma (Mute):** \`${totalMutes}\` adet\n» **Açtığı Destek Biletleri:** \`${totalTickets}\` adet`
                },
                {
                    name: `${eSignature} Moderatör Notları (${totalNotes} Adet)`,
                    value: lastNotesText
                },
                {
                    name: `${eShield} Sahip Olduğu Roller`,
                    value: roles.length > 250 ? roles.substring(0, 247) + '...' : roles
                }
            ];

            // 5. Eğer hedef kullanıcı YETKİLİ ise, moderasyon performansını da getir
            let isTargetStaff = false;
            if (targetMember && (
                targetMember.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                targetMember.permissions.has(PermissionFlagsBits.BanMembers) ||
                targetMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
                targetMember.permissions.has(PermissionFlagsBits.Administrator)
            )) {
                isTargetStaff = true;
            }

            if (!isTargetStaff) {
                const [checkRows, checkMuteRows, checkTicketRows] = await Promise.all([
                    conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetUser.id]),
                    conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetUser.id]),
                    conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetUser.id])
                ]);
                if (Number(checkRows[0]?.cnt) > 0 || Number(checkMuteRows[0]?.cnt) > 0 || Number(checkTicketRows[0]?.cnt) > 0) {
                    isTargetStaff = true;
                }
            }

            if (isTargetStaff) {
                const [staffWarnRows, delRows, staffTicketRows, modRows] = await Promise.all([
                    conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetUser.id]),
                    conn.query('SELECT COUNT(*) as cnt FROM deleted_messages WHERE guild_id = ? AND deleted_by = ?', [interaction.guild.id, targetUser.id]),
                    conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetUser.id]),
                    conn.query('SELECT action_type, COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND moderator_id = ? GROUP BY action_type', [interaction.guild.id, targetUser.id])
                ]);

                const totalWarnsGiven = Number(staffWarnRows[0]?.cnt || 0);
                const staffDelCount = Number(delRows[0]?.cnt || 0);
                const staffTicketCount = Number(staffTicketRows[0]?.cnt || 0);

                let totalBans = 0, totalKicks = 0, totalMutesGiven = 0;
                modRows.forEach(row => {
                    const c = Number(row.cnt);
                    if (row.action_type === 'ban') totalBans += c;
                    else if (row.action_type === 'kick') totalKicks += c;
                    else if (row.action_type === 'text_mute' || row.action_type === 'voice_mute') totalMutesGiven += c;
                });

                const totalStaffActions = totalWarnsGiven + staffDelCount + staffTicketCount + totalBans + totalKicks + totalMutesGiven;

                rawFields.push({
                    name: `${eSettings} Yetkili Moderasyon Performansı`,
                    value: `» **Toplam İşlem:** **${totalStaffActions}** adet\n» **Verilen Uyarı:** \`${totalWarnsGiven}\` | **Kapatılan Bilet:** \`${staffTicketCount}\`\n» **Uygulanan Ban:** \`${totalBans}\` | **Kick:** \`${totalKicks}\` | **Mute:** \`${totalMutesGiven}\`\n» **Silinen Mesaj (Clear):** \`${staffDelCount}\``
                });
            }

            const payload = createContainerMessage(
                'Kullanıcı Profil ve İstatistik Sorgusu',
                `<@${targetUser.id}> kullanıcısının sunucu kayıtları, istatistikleri ve ceza dökümü aşağıda listelenmiştir.`,
                '#2B2D31',
                [createSorguMenu(targetUser.id, 'sorgu_overview', isTargetStaff)],
                rawFields
            );

            await interaction.editReply(payload);

        } catch (err) {
            console.error('[Sorgu] Hata:', err);
            const errPayload = buildModBResponse({
                title: 'Sistem Hatası',
                textLines: ['Sorgu sırasında bir hata oluştu. Lütfen tekrar deneyin.']
            });
            await interaction.editReply(errPayload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
