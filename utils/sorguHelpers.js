const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require('discord.js');
const { buildModAPanel, buildModBResponse, COLORS, MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');

function buildSorguPanel({ title, description, fields = [], navRow, showSocials = false, actionRows = [] }) {
    let finalDesc = description || '';
    if (fields.length > 0) {
        finalDesc += '\n\n' + fields.map(f => `**${f.name}:**\n${f.value}`).join('\n\n');
    }
    return buildModAPanel({
        title,
        description: finalDesc,
        navRow,
        actionRows,
        showSocials
    });
}
const { pool } = require('../db');

function createSorguMenu(targetId, current = 'sorgu_overview', isStaff = false) {
    const options = [
        { label: 'Genel Bilgi & Ozeti', value: 'sorgu_overview', default: current === 'sorgu_overview' },
        { label: 'Sunucu Profil Geçmişi', value: 'sorgu_profile_server', default: current === 'sorgu_profile_server' },
        { label: 'Global Profil Geçmişi', value: 'sorgu_profile_global', default: current === 'sorgu_profile_global' },
        { label: 'Uyarı Geçmişi', value: 'sorgu_warns', default: current === 'sorgu_warns' },
        { label: 'Susturma Geçmişi', value: 'sorgu_mutes', default: current === 'sorgu_mutes' },
        { label: 'Ceza Geçmişi', value: 'sorgu_penalties', default: current === 'sorgu_penalties' },
        { label: 'Ticket Geçmişi', value: 'sorgu_tickets', default: current === 'sorgu_tickets' },
        { label: 'Silinen Mesajlar', value: 'sorgu_deleted', default: current === 'sorgu_deleted' }
    ];

    if (isStaff) {
        options.push({ label: 'Yetkili: Genel İşlem Akışı', value: 'sorgu_staff', default: current === 'sorgu_staff' });
        options.push({ label: 'Yetkili: Verilen Uyarılar', value: 'sorgu_staff_warns', default: current === 'sorgu_staff_warns' });
        options.push({ label: 'Yetkili: Atılan Mute/Ban', value: 'sorgu_staff_mutes', default: current === 'sorgu_staff_mutes' });
        options.push({ label: 'Yetkili: Silinen Mesajlar', value: 'sorgu_staff_dels', default: current === 'sorgu_staff_dels' });
        options.push({ label: 'Yetkili: Kapatılan Biletler', value: 'sorgu_staff_tickets', default: current === 'sorgu_staff_tickets' });
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`sorgu:select:${targetId}`)
        .setPlaceholder('Sorgu kategorisi secin...')
        .addOptions(options);
    
    return new ActionRowBuilder().addComponents(menu);
}

async function handleSorguSelect(interaction, value, targetId) {
    let conn;
    try {
        await interaction.deferUpdate().catch(() => {});
        const { PermissionFlagsBits, AuditLogEvent } = require('discord.js');
        conn = await pool.getConnection();
        const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        const userName = targetUser ? `${targetUser.username} (${targetUser.tag})` : targetId;

        let targetMember;
        try { targetMember = await interaction.guild.members.fetch(targetId); } catch { targetMember = null; }

        let isStaff = false;
        if (targetMember && (
            targetMember.permissions.has(PermissionFlagsBits.ModerateMembers) ||
            targetMember.permissions.has(PermissionFlagsBits.BanMembers) ||
            targetMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
            targetMember.permissions.has(PermissionFlagsBits.Administrator)
        )) {
            isStaff = true;
        }

        if (!isStaff) {
            const checkRows = await conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetId]);
            const checkMuteRows = await conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetId]);
            const checkTicketRows = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetId]);
            if (Number(checkRows[0]?.cnt) > 0 || Number(checkMuteRows[0]?.cnt) > 0 || Number(checkTicketRows[0]?.cnt) > 0) {
                isStaff = true;
            }
        }

        if (value === 'sorgu_profile_server') {
            const rows = await conn.query('SELECT * FROM user_history WHERE user_id = ? AND guild_id = ? AND change_type IN ("nickname", "server_avatar") ORDER BY changed_at DESC', [targetId, interaction.guild.id]);
            const historyRows = Array.isArray(rows) ? (rows.length > 0 && Array.isArray(rows[0]) && !rows[0].id ? rows[0] : rows) : [];
            const images = [];
            const fields = historyRows.slice(0, 10).map((m, i) => {
                let changeLabel = '';
                let oldV = m.old_value || 'Yok';
                let newV = m.new_value || 'Yok';

                if (m.change_type === 'nickname') {
                    changeLabel = 'Sunucu İçi İsim (Nickname)';
                    oldV = `\`${oldV}\``;
                    newV = `\`${newV}\``;
                } else if (m.change_type === 'server_avatar') {
                    changeLabel = 'Sunucu Profil Fotoğrafı (Server Avatar)';
                    if (m.old_value && m.old_value !== 'Yok' && m.old_value.startsWith('http')) images.push(m.old_value);
                    if (m.new_value && m.new_value !== 'Yok' && m.new_value.startsWith('http')) images.push(m.new_value);
                    oldV = `*Galeriye Eklendi*`;
                    newV = `*Galeriye Eklendi*`;
                }

                return {
                    name: `İşlem #${i + 1} - ${changeLabel}`,
                    value: `**Eski:** ${oldV}\n**Yeni:** ${newV}\n**Tarih:** <t:${Math.floor(new Date(m.changed_at).getTime() / 1000)}:f>`
                };
            });

            if (fields.length === 0) fields.push({ name: 'Kayıt Yok', value: 'Kullanıcıya ait herhangi bir sunucu içi profil veya isim değişikliği kaydı bulunamadı.' });
            
            const payload = buildSorguPanel({
                title: `Sunucu İçi Profil & İsim Geçmişi - ${userName}`,
                description: `Sistemde kayıtlı toplam **${historyRows.length}** değişiklik bulundu (Son 10 gösteriliyor).`,
                fields, navRow: createSorguMenu(targetId, 'sorgu_profile_server', isStaff), images
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_profile_global') {
            const rows = await conn.query('SELECT * FROM user_history WHERE user_id = ? AND change_type IN ("username", "global_avatar") ORDER BY changed_at DESC', [targetId]);
            const historyRows = Array.isArray(rows) ? (rows.length > 0 && Array.isArray(rows[0]) && !rows[0].id ? rows[0] : rows) : [];
            const images = [];
            const fields = historyRows.slice(0, 10).map((m, i) => {
                let changeLabel = '';
                let oldV = m.old_value || 'Yok';
                let newV = m.new_value || 'Yok';

                if (m.change_type === 'username') {
                    changeLabel = 'Global Kullanıcı Adı (Username)';
                    oldV = `\`${oldV}\``;
                    newV = `\`${newV}\``;
                } else if (m.change_type === 'global_avatar') {
                    changeLabel = 'Global Profil Fotoğrafı (Avatar)';
                    if (m.old_value && m.old_value !== 'Yok' && m.old_value.startsWith('http')) images.push(m.old_value);
                    if (m.new_value && m.new_value !== 'Yok' && m.new_value.startsWith('http')) images.push(m.new_value);
                    oldV = `*Galeriye Eklendi*`;
                    newV = `*Galeriye Eklendi*`;
                }

                return {
                    name: `İşlem #${i + 1} - ${changeLabel}`,
                    value: `**Eski:** ${oldV}\n**Yeni:** ${newV}\n**Tarih:** <t:${Math.floor(new Date(m.changed_at).getTime() / 1000)}:f>`
                };
            });

            if (fields.length === 0) fields.push({ name: 'Kayıt Yok', value: 'Kullanıcıya ait herhangi bir global profil değişikliği kaydı bulunamadı.' });
            
            const payload = buildSorguPanel({
                title: `Global Profil & İsim Geçmişi - ${userName}`,
                description: `Sistemde kayıtlı toplam **${historyRows.length}** değişiklik bulundu (Son 10 gösteriliyor).`,
                fields, navRow: createSorguMenu(targetId, 'sorgu_profile_global', isStaff), images
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_staff' && isStaff) {
            const warnRows = await conn.query('SELECT user_id, created_at, reason FROM warnings WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetId]);
            const delRows = await conn.query('SELECT user_id, deleted_at, reason FROM deleted_messages WHERE guild_id = ? AND deleted_by = ?', [interaction.guild.id, targetId]);
            const staffTicketRows = await conn.query('SELECT owner_id, closed_at, reason FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetId]);
            const modActionRows = await conn.query('SELECT user_id, action_type, created_at, reason FROM mutes WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetId]);

            let allActions = [];

            for (let w of warnRows) {
                allActions.push({ type: 'Uyarı Verildi', target: `<@${w.user_id}>`, date: new Date(w.created_at).getTime(), reason: w.reason || 'Belirtilmemis' });
            }
            for (let t of staffTicketRows) {
                if (!t.closed_at) continue;
                allActions.push({ type: 'Ticket Kapatildi', target: `<@${t.owner_id}>`, date: new Date(t.closed_at).getTime(), reason: t.reason || 'Belirtilmemis' });
            }
            for (let d of delRows) {
                allActions.push({ type: 'Mesaj Silindi', target: `<@${d.user_id}>`, date: new Date(d.deleted_at).getTime(), reason: d.reason || 'Belirtilmemis' });
            }
            for (let m of modActionRows) {
                let actName = m.action_type === 'ban' ? 'Banlandi' : (m.action_type === 'kick' ? 'Kicklendi' : 'Susturuldu (Timeout)');
                allActions.push({ type: actName, target: `<@${m.user_id}>`, date: new Date(m.created_at || Date.now()).getTime(), reason: m.reason || 'Belirtilmemis' });
            }

            try {
                const logs = await interaction.guild.fetchAuditLogs({ limit: 100, user: targetId });
                logs.entries.forEach(e => {
                    if (!e.target) return;
                    const targetName = e.target.username || e.target.tag || 'Bilinmeyen';
                    const date = e.createdAt.getTime();
                    
                    if (e.action === AuditLogEvent.MemberRoleUpdate) {
                        const addedRoles = e.changes?.find(c => c.key === '$add')?.new?.map(r => r.name).join(', ');
                        const removedRoles = e.changes?.find(c => c.key === '$remove')?.new?.map(r => r.name).join(', ');
                        
                        if (addedRoles) {
                            const isWarning = addedRoles.toLowerCase().includes('uyarı') || addedRoles.toLowerCase().includes('uyarı');
                            if (!isWarning) {
                                allActions.push({ type: 'Rol Verildi', target: targetName, date, reason: `Verilen Roller: ${addedRoles}` });
                            }
                        }
                        if (removedRoles) {
                            allActions.push({ type: 'Rol Alindi', target: targetName, date, reason: `Alinan Roller: ${removedRoles}` });
                        }
                    }
                });
            } catch (e) {
                console.error('Audit log fetch error:', e);
            }

            allActions.sort((a, b) => b.date - a.date);

            const fields = allActions.slice(0, 10).map((act, i) => ({
                name: `İşlem #${i + 1} - ${act.type}`,
                value: `**Kime:** ${act.target}\n**Tarih:** <t:${Math.floor(act.date / 1000)}:f>\n**Sebep:** ${act.reason}`
            }));

            if (fields.length === 0) {
                fields.push({ name: 'İşlem Yok', value: 'Bu yetkiliye ait kaydedilmis herhangi bir eylem bulunamadı.' });
            }

            const actionRows = [];
            if (allActions.length > 0) {
                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sorgu:export_staff:${targetId}`)
                        .setLabel(`Tum İşlem Gecmisini Indir (.txt - ${allActions.length} İşlem)`)
                        .setStyle(ButtonStyle.Primary)
                );
                actionRows.push(btnRow);
            }

            const payload = buildSorguPanel({
                title: `Genel İşlem Akışı - ${userName}`,
                description: `Son ${allActions.length > 10 ? '10' : allActions.length} işlem gosteriliyor. Toplam kaydedilmis işlem: **${allActions.length}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_staff', isStaff),
                actionRows,
                showSocials: false
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_staff_warns' && isStaff) {
            const rows = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND moderator_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            const fields = rows.slice(0, 10).map((m, i) => ({
                name: `Uyarı #${i + 1} (Hedef: <@${m.user_id}>)`,
                value: `**Tarih:** <t:${Math.floor(new Date(m.created_at).getTime() / 1000)}:f>\n**Sebep:** ${m.reason || 'Belirtilmemis'}`
            }));
            if (fields.length === 0) fields.push({ name: 'Kayıt Yok', value: 'Hiç uyarı vermemiş.' });
            
            const actionRows = [];
            if (rows.length > 0) {
                actionRows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sorgu:export_staff_warns:${targetId}`).setLabel(`Verilen Uyarıları İndir (.txt - ${rows.length})`).setStyle(ButtonStyle.Primary)
                ));
            }
            
            const payload = buildSorguPanel({
                title: `Yetkili: Verilen Uyarılar - ${userName}`,
                description: `Toplam **${rows.length}** uyarı verdi (Son 10 gösteriliyor).`,
                fields, navRow: createSorguMenu(targetId, 'sorgu_staff_warns', isStaff), actionRows
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_staff_mutes' && isStaff) {
            const rows = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND moderator_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            const fields = rows.slice(0, 10).map((m, i) => ({
                name: `İşlem #${i + 1} (Hedef: <@${m.user_id}>)`,
                value: `**Tür:** ${m.action_type}\n**Tarih:** <t:${Math.floor(new Date(m.created_at).getTime() / 1000)}:f>\n**Sebep:** ${m.reason || 'Belirtilmemis'}`
            }));
            if (fields.length === 0) fields.push({ name: 'Kayıt Yok', value: 'Hiç ceza atmamış.' });
            
            const actionRows = [];
            if (rows.length > 0) {
                actionRows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sorgu:export_staff_mutes:${targetId}`).setLabel(`Atılan Cezaları İndir (.txt - ${rows.length})`).setStyle(ButtonStyle.Primary)
                ));
            }
            
            const payload = buildSorguPanel({
                title: `Yetkili: Atılan Mute/Ban/Kick - ${userName}`,
                description: `Toplam **${rows.length}** ceza attı (Son 10 gösteriliyor).`,
                fields, navRow: createSorguMenu(targetId, 'sorgu_staff_mutes', isStaff), actionRows
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_staff_dels' && isStaff) {
            const rows = await conn.query('SELECT * FROM deleted_messages WHERE guild_id = ? AND deleted_by = ? ORDER BY deleted_at DESC', [interaction.guild.id, targetId]);
            const fields = rows.slice(0, 10).map((m, i) => ({
                name: `Silinen Mesaj #${i + 1} (Kanal: <#${m.channel_id}>)`,
                value: `**Hedef:** <@${m.user_id}>\n**İçerik:** \`${m.content?.substring(0, 50) || 'Bos'}\`\n**Tarih:** <t:${Math.floor(new Date(m.deleted_at).getTime() / 1000)}:f>`
            }));
            if (fields.length === 0) fields.push({ name: 'Kayıt Yok', value: 'Hiç mesaj silmemiş.' });
            
            const actionRows = [];
            if (rows.length > 0) {
                actionRows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sorgu:export_staff_dels:${targetId}`).setLabel(`Silinen Mesajları İndir (.txt - ${rows.length})`).setStyle(ButtonStyle.Primary)
                ));
            }
            
            const payload = buildSorguPanel({
                title: `Yetkili: Silinen Mesajlar - ${userName}`,
                description: `Toplam **${rows.length}** mesaj sildi (Son 10 gösteriliyor).`,
                fields, navRow: createSorguMenu(targetId, 'sorgu_staff_dels', isStaff), actionRows
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_staff_tickets' && isStaff) {
            const rows = await conn.query('SELECT * FROM tickets WHERE guild_id = ? AND closed_by = ? ORDER BY closed_at DESC', [interaction.guild.id, targetId]);
            const fields = rows.slice(0, 10).map((m, i) => ({
                name: `Ticket #${m.id} (Açan: <@${m.owner_id}>)`,
                value: `**Kategori:** ${m.category || 'Genel'}\n**Kapatılma Tarihi:** <t:${Math.floor(new Date(m.closed_at).getTime() / 1000)}:f>`
            }));
            if (fields.length === 0) fields.push({ name: 'Kayıt Yok', value: 'Hiç ticket kapatmamış.' });
            
            const actionRows = [];
            if (rows.length > 0) {
                actionRows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sorgu:export_staff_tickets:${targetId}`).setLabel(`Kapatılan Biletleri İndir (.txt - ${rows.length})`).setStyle(ButtonStyle.Primary)
                ));
            }
            
            const payload = buildSorguPanel({
                title: `Yetkili: Kapatılan Biletler - ${userName}`,
                description: `Toplam **${rows.length}** ticket kapattı (Son 10 gösteriliyor).`,
                fields, navRow: createSorguMenu(targetId, 'sorgu_staff_tickets', isStaff), actionRows
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_overview') {
            const [
                warnRows,
                totalWarnRows,
                muteRows,
                ticketRows,
                deletedRows,
                inviteStats,
                invitedByRows
            ] = await Promise.all([
                conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetId]),
                conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]),
                conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]),
                conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND owner_id = ?', [interaction.guild.id, targetId]),
                conn.query('SELECT COUNT(*) as cnt FROM deleted_messages WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]),
                conn.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN it.is_fake = TRUE THEN 1 ELSE 0 END) as fake_cnt,
                        SUM(CASE WHEN m.is_in_guild = FALSE THEN 1 ELSE 0 END) as leave_cnt,
                        SUM(CASE WHEN (it.is_fake = FALSE OR it.is_fake IS NULL) AND (m.is_in_guild = TRUE OR m.is_in_guild IS NULL) THEN 1 ELSE 0 END) as real_cnt
                    FROM invite_tracking it
                    LEFT JOIN members m ON it.user_id = m.user_id
                    WHERE it.guild_id = ? AND it.inviter_id = ?
                `, [interaction.guild.id, targetId]),
                conn.query('SELECT inviter_id, invite_code FROM invite_tracking WHERE guild_id = ? AND user_id = ? LIMIT 1', [interaction.guild.id, targetId])
            ]);

            const realInvites = Number(inviteStats[0]?.real_cnt || 0);
            const fakeInvites = Number(inviteStats[0]?.fake_cnt || 0);
            const leaveInvites = Number(inviteStats[0]?.leave_cnt || 0);

            let invitedByText = 'Bilinmiyor';
            if (invitedByRows && invitedByRows.length > 0) {
                const codeText = invitedByRows[0].invite_code ? ` (Link: discord.gg/${invitedByRows[0].invite_code})` : '';
                invitedByText = `<@${invitedByRows[0].inviter_id}>${codeText}`;
            }

            const roles = targetMember ? targetMember.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position).map(r => `<@&${r.id}>`).join(', ') || 'Rol yok' : 'Sunucuda değil';
            const joinDate = targetMember?.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>` : 'Bilinmiyor';
            const createDate = targetUser ? `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>` : 'Bilinmiyor';

            let staffDesc = '';
            if (isStaff) {
                const staffWarnRows = await conn.query('SELECT reason, COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND moderator_id = ? GROUP BY reason', [interaction.guild.id, targetId]);
                let totalWarnsGiven = 0;
                let manualWarns = 0;
                staffWarnRows.forEach(row => {
                    const c = Number(row.cnt);
                    totalWarnsGiven += c;
                    if (row.reason && row.reason.includes('Manuel olarak')) manualWarns += c;
                });

                const delRows = await conn.query('SELECT COUNT(*) as cnt FROM deleted_messages WHERE guild_id = ? AND deleted_by = ?', [interaction.guild.id, targetId]);
                const totalDels = Number(delRows[0]?.cnt || 0);

                const staffTicketRows = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetId]);
                const totalTicketsClosed = Number(staffTicketRows[0]?.cnt || 0);

                let totalBans = 0, totalKicks = 0, totalTimeouts = 0, manualMutes = 0, manualBans = 0, totalRoles = 0;
                
                try {
                    const modRows = await conn.query('SELECT action_type, reason, COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND moderator_id = ? GROUP BY action_type, reason', [interaction.guild.id, targetId]);
                    modRows.forEach(row => {
                        const c = Number(row.cnt);
                        if (row.action_type === 'ban') {
                            totalBans += c;
                            if (row.reason && row.reason.includes('Manuel olarak')) manualBans += c;
                        }
                        else if (row.action_type === 'kick') totalKicks += c;
                        else if (row.action_type === 'text_mute' || row.action_type === 'voice_mute') {
                            totalTimeouts += c;
                            if (row.reason && row.reason.includes('Manuel olarak')) manualMutes += c;
                        }
                    });
                } catch(e) {}

                try {
                    const logs = await interaction.guild.fetchAuditLogs({ limit: 100, user: targetId });
                    logs.entries.forEach(e => {
                        if (e.action === AuditLogEvent.MemberRoleUpdate) {
                            const addedRoles = e.changes?.find(c => c.key === '$add')?.new?.map(r => r.name).join(', ');
                            if (addedRoles) {
                                totalRoles++;
                            }
                        }
                    });
                } catch(e) {}

                const finalWarns = totalWarnsGiven;

                staffDesc = `**<:mono:${MONO_EMOJIS.crown}> Moderasyon Özeti:**\n`;
                staffDesc += `└ Toplam İşlem: **${finalWarns + totalDels + totalTicketsClosed + totalBans + totalKicks + totalTimeouts + totalRoles}**\n`;
                staffDesc += `└ Atılan Uyarı: **${finalWarns}** *(Komut: ${finalWarns - manualWarns}, Manuel: ${manualWarns})*\n`;
                staffDesc += `└ Kapatılan Bilet: **${totalTicketsClosed}**\n`;
                staffDesc += `└ Atılan Ban: **${totalBans}** *(Komut: ${totalBans - manualBans}, Manuel: ${manualBans})*\n`;
                staffDesc += `└ Kick: **${totalKicks}** | Mute: **${totalTimeouts}** *(Manuel Mute: ${manualMutes})*\n`;
                staffDesc += `└ Silinen Mesaj (Clear): **${totalDels}**\n`;
            }

            const fieldsArr = [
                { name: `<:mono:${MONO_EMOJIS.shield}> Roller`, value: (roles.length > 200 ? roles.substring(0, 200) + '...' : roles) },
                { name: `<:mono:${MONO_EMOJIS.invite}> Davet İstatistikleri (Korumalı)`, value: `**Davet Eden:** ${invitedByText}\n**Gerçek:** **${realInvites}** | **Sahte:** **${fakeInvites}** | **Ayrılan:** **${leaveInvites}** | **Net:** **${realInvites}**` },
                { name: `<:mono:${MONO_EMOJIS.warning}> Ceza Istatistikleri`, value: `Aktif Uyarı: **${Number(warnRows[0]?.cnt || 0)}** | Toplam Uyarı: **${Number(totalWarnRows[0]?.cnt || 0)}**\nToplam Susturma: **${Number(muteRows[0]?.cnt || 0)}** | Toplam Ticket: **${Number(ticketRows[0]?.cnt || 0)}**` }
            ];

            if (isStaff && staffDesc) {
                fieldsArr.push({ name: `<:mono:${MONO_EMOJIS.settings}> Yetkili Geçmişi (Sicil)`, value: staffDesc });
            }

            const payload = createContainerMessage(
                'Kullanıcı Sorgu Paneli',
                `Aşağıda <@${targetId}> adlı kullanıcının detaylı sicil bilgilerine ulaşabilirsiniz.\n\n**Kayıt Tarihi:** ${createDate}\n**Sunucuya Katılım:** ${joinDate}`,
                '#2B2D31',
                [createSorguMenu(targetId, 'sorgu_overview', isStaff)],
                fieldsArr
            );
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_warns') {
            const rows = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Uyarı Geçmişi - ${userName}`,
                    description: 'Bu kullanıcıya ait kayitli hicbir uyarı bulunmamaktadır. (Temiz)',
                    navRow: createSorguMenu(targetId, 'sorgu_warns', isStaff),
                    showSocials: false
                });
                return interaction.editReply(payload);
            }

            const activeWarns = rows.filter(r => r.is_active).length;
            const totalWarns = rows.length;

            const fields = rows.slice(0, 8).map((w) => {
                const modTag = w.moderator_id ? `<@${w.moderator_id}>` : 'Sistem';
                const date = Math.floor(new Date(w.created_at).getTime() / 1000);
                return {
                    name: `Kayit #${w.id} [${w.is_active ? 'AKTIF' : 'PASIF'}]`,
                    value: `**Sebep:** ${w.reason || 'Belirtilmemis'}\n**Yetkili:** ${modTag}\n**Tarih:** <t:${date}:f>`
                };
            });

            const actionRows = [];
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sorgu:export_warns:${targetId}`)
                    .setLabel(`Tum Uyarı Gecmisini Indir (.txt - ${totalWarns} Kayit)`)
                    .setStyle(ButtonStyle.Primary)
            );
            actionRows.push(btnRow);

            const payload = buildSorguPanel({
                title: `Uyarı Geçmişi - ${userName}`,
                description: `Aktif Uyarı: **${activeWarns}** | Toplam Uyarı Kaydi: **${totalWarns}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_warns', isStaff),
                actionRows,
                showSocials: false
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_mutes') {
            const rows = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Susturma Geçmişi - ${userName}`,
                    description: 'Bu kullanıcıya ait kayitli susturma bulunamadı.',
                    navRow: createSorguMenu(targetId, 'sorgu_mutes', isStaff),
                    showSocials: false
                });
                return interaction.editReply(payload);
            }

            const fields = rows.slice(0, 8).map((m) => ({
                name: `Susturma #${m.id} [${m.is_active ? 'AKTIF' : 'BITMIS'}]`,
                value: `Tur: ${m.action_type || 'text'}\nSebep: ${m.reason || 'Belirtilmemis'}\nBitis: ${m.expires_at ? `<t:${Math.floor(new Date(m.expires_at).getTime() / 1000)}:f>` : 'Suresiz'}`
            }));

            const actionRows = [];
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sorgu:export_mutes:${targetId}`)
                    .setLabel(`Tum Susturma Kayitlarini Indir (.txt - ${rows.length} Kayit)`)
                    .setStyle(ButtonStyle.Primary)
            );
            actionRows.push(btnRow);

            const payload = buildSorguPanel({
                title: `Susturma Geçmişi - ${userName}`,
                description: `Toplam Susturma Kaydi: **${rows.length}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_mutes', isStaff),
                actionRows,
                showSocials: false
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_penalties') {
            const warns = await conn.query('SELECT id, created_at, reason, moderator_id, is_active FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            const mutes = await conn.query('SELECT id, reason, action_type, is_active FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);

            const totalPenalties = warns.length + mutes.length;

            const fields = [];
            if (warns.length > 0) {
                fields.push({
                    name: `Uyarılar (${warns.length})`,
                    value: warns.slice(0, 5).map(w => `#${w.id} - <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:d> [${w.is_active ? 'AKTIF' : 'PASIF'}] - ${w.reason || 'Sebep yok'}`).join('\n')
                });
            }
            if (mutes.length > 0) {
                fields.push({
                    name: `Susturmalar (${mutes.length})`,
                    value: mutes.slice(0, 5).map(m => `#${m.id} - ${m.action_type || 'text'} [${m.is_active ? 'AKTIF' : 'BITMIS'}] - ${m.reason || 'Sebep yok'}`).join('\n')
                });
            }
            if (fields.length === 0) fields.push({ name: 'Kayit Yok', value: 'Bu kullanıcıya ait ceza kaydi bulunamadı.' });

            const actionRows = [];
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sorgu:export_penalties:${targetId}`)
                    .setLabel(`Tum Ceza Dosyasini Indir (.txt - ${totalPenalties} Kayit)`)
                    .setStyle(ButtonStyle.Primary)
            );
            actionRows.push(btnRow);

            const payload = buildSorguPanel({
                title: `Ceza Geçmişi - ${userName}`,
                description: `Toplam Ceza / İşlem Sayısı: **${totalPenalties}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_penalties', isStaff),
                actionRows,
                showSocials: false
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_tickets') {
            const rows = await conn.query('SELECT * FROM tickets WHERE guild_id = ? AND owner_id = ? ORDER BY opened_at DESC', [interaction.guild.id, targetId]);
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Ticket Geçmişi - ${userName}`,
                    description: 'Bu kullanıcıya ait ticket kaydi bulunamadı.',
                    navRow: createSorguMenu(targetId, 'sorgu_tickets', isStaff),
                    showSocials: false
                });
                return interaction.editReply(payload);
            }

            const fields = rows.slice(0, 8).map((t) => ({
                name: `Ticket #${t.id} [${t.status === 'open' ? 'Acik' : 'Kapali'}]`,
                value: `Kategori: ${t.category || 'Genel'}\nSebep: ${t.reason?.substring(0, 100) || 'Belirtilmemis'}\nTarih: <t:${Math.floor(new Date(t.opened_at).getTime() / 1000)}:f>`
            }));

            const actionRows = [];

            const closedTickets = rows.filter(t => t.status === 'closed');
            if (closedTickets.length > 0) {
                const transcriptSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`sorgu:transcript_picker:${targetId}`)
                    .setPlaceholder('HTML Transcriptini indirmek istediginiz ticketı secin...')
                    .addOptions(
                        closedTickets.slice(0, 25).map(t => ({
                            label: `Ticket #${t.id} (${t.category || 'Genel'})`,
                            description: `Tarih: ${new Date(t.opened_at).toLocaleDateString('tr-TR')} - HTML Transcript Indir`,
                            value: `sorgu:transcript:${t.id}`
                        }))
                    );
                actionRows.push(new ActionRowBuilder().addComponents(transcriptSelectMenu));
            }

            if (rows.length > 8) {
                const exportBtnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sorgu:export_tickets:${targetId}`)
                        .setLabel(`Tum Ticket Gecmisini Indir (.txt - ${rows.length} Ticket)`)
                        .setStyle(ButtonStyle.Primary)
                );
                actionRows.push(exportBtnRow);
            }

            const payload = buildSorguPanel({
                title: `Ticket Geçmişi - ${userName}`,
                description: `Toplam Ticket Sayısı: **${rows.length}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_tickets', isStaff),
                actionRows,
                showSocials: false
            });
            return interaction.editReply(payload);
        }

        if (value === 'sorgu_deleted') {
            const rows = await conn.query('SELECT * FROM deleted_messages WHERE guild_id = ? AND user_id = ? ORDER BY deleted_at DESC', [interaction.guild.id, targetId]);
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Silinen Mesajlar - ${userName}`,
                    description: 'Bu kullanıcıya ait veritabaninda silinmis mesaj kaydi bulunamadı.',
                    navRow: createSorguMenu(targetId, 'sorgu_deleted', isStaff),
                    showSocials: false
                });
                return interaction.editReply(payload);
            }

            const fields = rows.slice(0, 8).map((m, i) => {
                const deletedBy = m.deleted_by ? (m.deleted_by === m.user_id ? 'Kullanıcı Kendi Sildi' : `<@${m.deleted_by}>`) : 'Bilinmiyor';
                return {
                    name: `Silinen Mesaj #${i + 1}`,
                    value: `Kanal: <#${m.channel_id}>\nSilen: ${deletedBy}\nSebep: ${m.reason || 'Belirtilmemis'}\nIcerik: \`${m.content?.substring(0, 120) || '[Bos]'}\`\nTarih: <t:${Math.floor(new Date(m.deleted_at).getTime() / 1000)}:f>`
                };
            });

            const actionRows = [];
            // Sadece tek mesaja sigmadiginda (>8 mesaj) indirme butonunu göster
            if (rows.length > 8) {
                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sorgu:export_deleted:${targetId}`)
                        .setLabel(`Tum Silinen Mesajlari Indir (.txt - ${rows.length} Mesaj)`)
                        .setStyle(ButtonStyle.Primary)
                );
                actionRows.push(btnRow);
            }

            const payload = buildSorguPanel({
                title: `Silinen Mesajlar - ${userName}`,
                description: `Toplam Silinen Mesaj Kaydi: **${rows.length}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_deleted', isStaff),
                actionRows,
                showSocials: false
            });
            return interaction.editReply(payload);
        }
    } catch (err) {
        console.error('[Sorgu] Select handler hatası:', err);
        const errPayload = buildModBResponse({
            title: 'Sistem Hatasi',
            textLines: ['Sorgu sırasında bir hata oluştu.'],
            color: COLORS.ERROR
        });
        return interaction.editReply(errPayload).catch(() => {});
    } finally {
        if (conn) conn.release();
    }
}

async function handleExport(interaction, exportType, targetId) {
    let conn;
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
        conn = await pool.getConnection();
        const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        const userTag = targetUser ? `${targetUser.username} (${targetUser.tag})` : targetId;

        let filename = '';
        let txtContent = '';

        if (exportType === 'warns' || exportType === 'sicil') {
            filename = `${targetId}-uyarilar.txt`;
            const rows = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            txtContent += `UYARI GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Uyarı Kaydi: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const date = new Date(r.created_at).toLocaleString('tr-TR');
                txtContent += `[Kayit #${r.id}] Durum: ${r.is_active ? 'AKTIF' : 'PASIF'}\nTarih: ${date}\nYetkili: ${r.moderator_id || 'Sistem'}\nSebep: ${r.reason || 'Belirtilmemis'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'mutes') {
            filename = `${targetId}-susturmalar.txt`;
            const rows = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);
            txtContent += `SUSTURMA GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Susturma Kaydi: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const date = r.created_at ? new Date(r.created_at).toLocaleString('tr-TR') : 'Bilinmiyor';
                txtContent += `[Susturma #${r.id}] Tur: ${r.action_type || 'text'} | Durum: ${r.is_active ? 'AKTIF' : 'BITMIS'}\nTarih: ${date}\nSebep: ${r.reason || 'Belirtilmemis'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'penalties') {
            filename = `${targetId}-ceza-geçmişi.txt`;
            const warns = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            const mutes = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);
            txtContent += `CEZA GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Uyarı: ${warns.length} | Toplam Susturma: ${mutes.length}\n`;
            txtContent += `====================================================\n\n`;
            txtContent += `--- UYARILAR ---\n`;
            for (const r of warns) {
                const date = new Date(r.created_at).toLocaleString('tr-TR');
                txtContent += `[Uyarı #${r.id}] Durum: ${r.is_active ? 'AKTIF' : 'PASIF'} | Tarih: ${date} | Yetkili: ${r.moderator_id || 'Sistem'}\nSebep: ${r.reason || 'Belirtilmemis'}\n`;
            }
            txtContent += `\n--- SUSTURMALAR ---\n`;
            for (const r of mutes) {
                txtContent += `[Susturma #${r.id}] Tur: ${r.action_type || 'text'} | Durum: ${r.is_active ? 'AKTIF' : 'BITMIS'}\nSebep: ${r.reason || 'Belirtilmemis'}\n`;
            }
        }
        else if (exportType === 'tickets') {
            filename = `${targetId}-ticketlar.txt`;
            const rows = await conn.query('SELECT * FROM tickets WHERE guild_id = ? AND owner_id = ? ORDER BY opened_at DESC', [interaction.guild.id, targetId]);
            txtContent += `TICKET GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Ticket Sayısı: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const openDate = new Date(r.opened_at).toLocaleString('tr-TR');
                const closeDate = r.closed_at ? new Date(r.closed_at).toLocaleString('tr-TR') : 'Hala Acik';
                txtContent += `[Ticket #${r.id}] Durum: ${r.status.toUpperCase()} | Kategori: ${r.category || 'Genel'}\nAçılış: ${openDate} | Kapanış: ${closeDate}\nSebep: ${r.reason || 'Belirtilmemis'}\nKapatan: ${r.closed_by || '-'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'deleted') {
            filename = `${targetId}-silinen-mesajlar.txt`;
            const rows = await conn.query('SELECT * FROM deleted_messages WHERE guild_id = ? AND user_id = ? ORDER BY deleted_at DESC', [interaction.guild.id, targetId]);
            txtContent += `SILINEN MESAJLAR DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Silinen Mesaj Kaydi: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const date = new Date(r.deleted_at).toLocaleString('tr-TR');
                const deletedBy = r.deleted_by ? (r.deleted_by === r.user_id ? 'Kullanıcı Kendi Sildi' : r.deleted_by) : 'Bilinmiyor';
                txtContent += `[Tarih: ${date}] Kanal: #${r.channel_id}\nSilen Yetkili/Kişi: ${deletedBy}\nSebep: ${r.reason || 'Belirtilmedi'}\nMesaj: ${r.content || '[Icerik Yok]'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'staff') {
            const { AuditLogEvent } = require('discord.js');
            filename = `${targetId}-yetkili-işlem-geçmişi.txt`;
            const warnRows = await conn.query('SELECT user_id, created_at, reason FROM warnings WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetId]);
            const delRows = await conn.query('SELECT user_id, deleted_at, reason FROM deleted_messages WHERE guild_id = ? AND deleted_by = ?', [interaction.guild.id, targetId]);
            const staffTicketRows = await conn.query('SELECT owner_id, closed_at, reason FROM tickets WHERE guild_id = ? AND closed_by = ?', [interaction.guild.id, targetId]);
            const modActionRows = await conn.query('SELECT user_id, action_type, created_at, reason FROM mutes WHERE guild_id = ? AND moderator_id = ?', [interaction.guild.id, targetId]);

            let allActions = [];

            for (let w of warnRows) {
                allActions.push({ type: 'Uyarı Verildi', target: w.user_id, date: new Date(w.created_at).getTime(), reason: w.reason || 'Belirtilmemis' });
            }
            for (let t of staffTicketRows) {
                if (!t.closed_at) continue;
                allActions.push({ type: 'Ticket Kapatildi', target: t.owner_id, date: new Date(t.closed_at).getTime(), reason: t.reason || 'Belirtilmemis' });
            }
            for (let d of delRows) {
                allActions.push({ type: 'Mesaj Silindi', target: d.user_id, date: new Date(d.deleted_at).getTime(), reason: d.reason || 'Belirtilmemis' });
            }
            for (let m of modActionRows) {
                let actName = m.action_type === 'ban' ? 'Ban' : (m.action_type === 'kick' ? 'Kick' : 'Susturma (Timeout)');
                allActions.push({ type: actName, target: m.user_id, date: new Date(m.created_at || Date.now()).getTime(), reason: m.reason || 'Belirtilmemis' });
            }

            try {
                const logs = await interaction.guild.fetchAuditLogs({ limit: 100, user: targetId });
                logs.entries.forEach(e => {
                    if (!e.target) return;
                    const targetName = e.target.username || e.target.tag || 'Bilinmeyen';
                    const date = e.createdAt.getTime();
                    const reason = e.reason || 'Belirtilmemis';
                    
                    if (e.action === AuditLogEvent.MemberBanAdd) {
                        allActions.push({ type: 'Ban', target: targetName, date, reason });
                    } else if (e.action === AuditLogEvent.MemberKick) {
                        allActions.push({ type: 'Kick', target: targetName, date, reason });
                    } else if (e.action === AuditLogEvent.MemberUpdate && e.changes?.some(c => c.key === 'communication_disabled_until' && c.new)) {
                        allActions.push({ type: 'Susturma (Timeout)', target: targetName, date, reason });
                    } else if (e.action === AuditLogEvent.MemberRoleUpdate) {
                        const addedRoles = e.changes?.find(c => c.key === '$add')?.new?.map(r => r.name).join(', ');
                        const removedRoles = e.changes?.find(c => c.key === '$remove')?.new?.map(r => r.name).join(', ');
                        
                        if (addedRoles) {
                            const isWarning = addedRoles.toLowerCase().includes('uyarı') || addedRoles.toLowerCase().includes('uyarı');
                            const typeLabel = isWarning ? 'Uyarı Verildi (Rol)' : 'Rol Verildi';
                            allActions.push({ type: typeLabel, target: targetName, date, reason: `Verilen Roller: ${addedRoles}` });
                        }
                        if (removedRoles) {
                            allActions.push({ type: 'Rol Alindi', target: targetName, date, reason: `Alinan Roller: ${removedRoles}` });
                        }
                    }
                });
            } catch (e) {
                console.error('Audit log fetch error:', e);
            }

            allActions.sort((a, b) => b.date - a.date);

            txtContent += `YETKİLİ ISLEM GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam İşlem Sayısı: ${allActions.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const act of allActions) {
                const dateStr = new Date(act.date).toLocaleString('tr-TR');
                txtContent += `[Tarih: ${dateStr}] İşlem Turu: ${act.type}\nKime (Hedef): ${act.target}\nSebep: ${act.reason}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'staff_warns') {
            filename = `${targetId}-verdigi-uyarilar.txt`;
            const rows = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND moderator_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            txtContent += `VERDIGI UYARILAR DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Uyarı: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const date = new Date(r.created_at).toLocaleString('tr-TR');
                txtContent += `[Uyarı #${r.id}] Kime: ${r.user_id} | Tarih: ${date}\nSebep: ${r.reason || 'Belirtilmemis'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'staff_mutes') {
            filename = `${targetId}-attigi-cezalar.txt`;
            const rows = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND moderator_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            txtContent += `ATTIGI CEZALAR DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Ceza: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const date = r.created_at ? new Date(r.created_at).toLocaleString('tr-TR') : 'Bilinmiyor';
                txtContent += `[Ceza #${r.id}] Tür: ${r.action_type} | Kime: ${r.user_id} | Tarih: ${date}\nSebep: ${r.reason || 'Belirtilmemis'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'staff_dels') {
            filename = `${targetId}-sildigi-mesajlar.txt`;
            const rows = await conn.query('SELECT * FROM deleted_messages WHERE guild_id = ? AND deleted_by = ? ORDER BY deleted_at DESC', [interaction.guild.id, targetId]);
            txtContent += `SILDIGI MESAJLAR DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Mesaj: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const date = new Date(r.deleted_at).toLocaleString('tr-TR');
                txtContent += `[Tarih: ${date}] Kanal: #${r.channel_id} | Kimin Mesajı: ${r.user_id}\nSebep: ${r.reason || 'Belirtilmedi'}\nMesaj: ${r.content || '[Icerik Yok]'}\n-----------------------------------\n`;
            }
        }
        else if (exportType === 'staff_tickets') {
            filename = `${targetId}-kapattigi-biletler.txt`;
            const rows = await conn.query('SELECT * FROM tickets WHERE guild_id = ? AND closed_by = ? ORDER BY closed_at DESC', [interaction.guild.id, targetId]);
            txtContent += `KAPATTIGI TICKETLAR DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Ticket: ${rows.length}\n`;
            txtContent += `====================================================\n\n`;
            for (const r of rows) {
                const openDate = new Date(r.opened_at).toLocaleString('tr-TR');
                const closeDate = r.closed_at ? new Date(r.closed_at).toLocaleString('tr-TR') : 'Hala Acik';
                txtContent += `[Ticket #${r.id}] Açan: ${r.owner_id} | Kategori: ${r.category || 'Genel'}\nAçılış: ${openDate} | Kapanış: ${closeDate}\nSebep: ${r.reason || 'Belirtilmemis'}\n-----------------------------------\n`;
            }
        }

        if (!txtContent || txtContent.trim().length === 0) {
            const emptyPayload = buildModBResponse({
                title: 'Bilgi',
                textLines: ['Kayitli veri bulunamadı.']
            });
            return interaction.editReply(emptyPayload);
        }

        const attachment = new AttachmentBuilder(Buffer.from(txtContent, 'utf-8'), { name: filename });
        const successPayload = buildModBResponse({
            title: 'Disa Aktarim Basarili',
            textLines: [`**${userTag}** kullanicisina ait **${exportType.toUpperCase()}** dökümü tarafiniza dosya formatinda aktarilmistir:`],
            color: COLORS.SUCCESS
        });
        successPayload.files = [attachment];
        return interaction.editReply(successPayload);
    } catch (err) {
        console.error('[Export Handler] Hata:', err);
        const errPayload = buildModBResponse({
            title: 'Sistem Hatasi',
            textLines: ['Dokum dosyasi olusturulurken bir hata meydana geldi.'],
            color: COLORS.ERROR
        });
        return interaction.editReply(errPayload).catch(() => {});
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { createSorguMenu, handleSorguSelect, handleExport, handleSicilExport: handleExport };
