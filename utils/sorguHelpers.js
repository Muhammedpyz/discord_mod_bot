const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require('discord.js');
const { buildModAPanel, buildModBResponse, COLORS } = require('./uiBuilder');

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

function createSorguMenu(targetId, current = 'sorgu_overview') {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`sorgu:select:${targetId}`)
        .setPlaceholder('Sorgu kategorisi secin...')
        .addOptions([
            { label: 'Genel Bilgi & Ozeti', value: 'sorgu_overview', default: current === 'sorgu_overview' },
            { label: 'Uyari Gecmisi', value: 'sorgu_warns', default: current === 'sorgu_warns' },
            { label: 'Susturma Gecmisi', value: 'sorgu_mutes', default: current === 'sorgu_mutes' },
            { label: 'Ceza Gecmisi', value: 'sorgu_penalties', default: current === 'sorgu_penalties' },
            { label: 'Ticket Gecmisi', value: 'sorgu_tickets', default: current === 'sorgu_tickets' },
            { label: 'Silinen Mesajlar', value: 'sorgu_deleted', default: current === 'sorgu_deleted' }
        ]);
    return new ActionRowBuilder().addComponents(menu);
}

async function handleSorguSelect(interaction, value, targetId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        const userName = targetUser ? `${targetUser.username} (${targetUser.tag})` : targetId;

        if (value === 'sorgu_overview') {
            let targetMember;
            try { targetMember = await interaction.guild.members.fetch(targetId); } catch { targetMember = null; }

            const [warnRows] = await conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetId]);
            const [totalWarnRows] = await conn.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]);
            const [muteRows] = await conn.query('SELECT COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]);
            const [ticketRows] = await conn.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND owner_id = ?', [interaction.guild.id, targetId]);
            const [deletedRows] = await conn.query('SELECT COUNT(*) as cnt FROM deleted_messages WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]);

            const roles = targetMember ? targetMember.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position).map(r => `<@&${r.id}>`).join(', ') || 'Rol yok' : 'Sunucuda degil';
            const joinDate = targetMember?.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>` : 'Bilinmiyor';
            const createDate = targetUser ? `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>` : 'Bilinmiyor';

            const actionRows = [];

            const payload = buildSorguPanel({
                title: 'Kullanici Sorgu Paneli',
                description: `**Kullanici:** ${userName}\n**ID:** \`${targetId}\`\n**Hesap Olusturma:** ${createDate}\n**Sunucuya Katilim:** ${joinDate}`,
                fields: [
                    { name: 'Roller', value: (roles.length > 200 ? roles.substring(0, 200) + '...' : roles) },
                    { name: 'Sicil & Kayit Ozeti', value: `Aktif Uyari: **${Number(warnRows[0]?.cnt || 0)}** | Toplam Uyari: **${Number(totalWarnRows[0]?.cnt || 0)}**\nToplam Susturma: **${Number(muteRows[0]?.cnt || 0)}** | Toplam Ticket: **${Number(ticketRows[0]?.cnt || 0)}**\nSilinen Mesaj Kaydi: **${Number(deletedRows[0]?.cnt || 0)}**` }
                ],
                navRow: createSorguMenu(targetId, 'sorgu_overview'),
                actionRows,
                showSocials: true
            });
            return interaction.update(payload);
        }

        if (value === 'sorgu_warns') {
            const rows = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Uyari Gecmisi - ${userName}`,
                    description: 'Bu kullaniciya ait kayitli hicbir uyari bulunmamaktadir. (Temiz)',
                    navRow: createSorguMenu(targetId, 'sorgu_warns'),
                    showSocials: false
                });
                return interaction.update(payload);
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
                    .setLabel(`Tum Uyari Gecmisini Indir (.txt - ${totalWarns} Kayit)`)
                    .setStyle(ButtonStyle.Primary)
            );
            actionRows.push(btnRow);

            const payload = buildSorguPanel({
                title: `Uyari Gecmisi - ${userName}`,
                description: `Aktif Uyari: **${activeWarns}** | Toplam Uyari Kaydi: **${totalWarns}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_warns'),
                actionRows,
                showSocials: false
            });
            return interaction.update(payload);
        }

        if (value === 'sorgu_mutes') {
            const rows = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Susturma Gecmisi - ${userName}`,
                    description: 'Bu kullaniciya ait kayitli susturma bulunamadi.',
                    navRow: createSorguMenu(targetId, 'sorgu_mutes'),
                    showSocials: false
                });
                return interaction.update(payload);
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
                title: `Susturma Gecmisi - ${userName}`,
                description: `Toplam Susturma Kaydi: **${rows.length}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_mutes'),
                actionRows,
                showSocials: false
            });
            return interaction.update(payload);
        }

        if (value === 'sorgu_penalties') {
            const warns = await conn.query('SELECT id, created_at, reason, moderator_id, is_active FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            const mutes = await conn.query('SELECT id, reason, action_type, is_active FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);

            const totalPenalties = warns.length + mutes.length;

            const fields = [];
            if (warns.length > 0) {
                fields.push({
                    name: `Uyarilar (${warns.length})`,
                    value: warns.slice(0, 5).map(w => `#${w.id} - <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:d> [${w.is_active ? 'AKTIF' : 'PASIF'}] - ${w.reason || 'Sebep yok'}`).join('\n')
                });
            }
            if (mutes.length > 0) {
                fields.push({
                    name: `Susturmalar (${mutes.length})`,
                    value: mutes.slice(0, 5).map(m => `#${m.id} - ${m.action_type || 'text'} [${m.is_active ? 'AKTIF' : 'BITMIS'}] - ${m.reason || 'Sebep yok'}`).join('\n')
                });
            }
            if (fields.length === 0) fields.push({ name: 'Kayit Yok', value: 'Bu kullaniciya ait ceza kaydi bulunamadi.' });

            const actionRows = [];
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sorgu:export_penalties:${targetId}`)
                    .setLabel(`Tum Ceza Dosyasini Indir (.txt - ${totalPenalties} Kayit)`)
                    .setStyle(ButtonStyle.Primary)
            );
            actionRows.push(btnRow);

            const payload = buildSorguPanel({
                title: `Ceza Gecmisi - ${userName}`,
                description: `Toplam Ceza / Islem Sayisi: **${totalPenalties}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_penalties'),
                actionRows,
                showSocials: false
            });
            return interaction.update(payload);
        }

        if (value === 'sorgu_tickets') {
            const rows = await conn.query('SELECT * FROM tickets WHERE guild_id = ? AND owner_id = ? ORDER BY opened_at DESC', [interaction.guild.id, targetId]);
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Ticket Gecmisi - ${userName}`,
                    description: 'Bu kullaniciya ait ticket kaydi bulunamadi.',
                    navRow: createSorguMenu(targetId, 'sorgu_tickets'),
                    showSocials: false
                });
                return interaction.update(payload);
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
                title: `Ticket Gecmisi - ${userName}`,
                description: `Toplam Ticket Sayisi: **${rows.length}**`,
                fields,
                navRow: createSorguMenu(targetId, 'sorgu_tickets'),
                actionRows,
                showSocials: false
            });
            return interaction.update(payload);
        }

        if (value === 'sorgu_deleted') {
            const rows = await conn.query('SELECT * FROM deleted_messages WHERE guild_id = ? AND user_id = ? ORDER BY deleted_at DESC', [interaction.guild.id, targetId]);
            if (rows.length === 0) {
                const payload = buildSorguPanel({
                    title: `Silinen Mesajlar - ${userName}`,
                    description: 'Bu kullaniciya ait veritabaninda silinmis mesaj kaydi bulunamadi.',
                    navRow: createSorguMenu(targetId, 'sorgu_deleted'),
                    showSocials: false
                });
                return interaction.update(payload);
            }

            const fields = rows.slice(0, 8).map((m, i) => {
                const deletedBy = m.deleted_by ? (m.deleted_by === m.user_id ? 'Kullanıcı Kendi Sildi' : `<@${m.deleted_by}>`) : 'Bilinmiyor';
                return {
                    name: `Silinen Mesaj #${i + 1}`,
                    value: `Kanal: <#${m.channel_id}>\nSilen: ${deletedBy}\nSebep: ${m.reason || 'Belirtilmemis'}\nIcerik: \`${m.content?.substring(0, 120) || '[Bos]'}\`\nTarih: <t:${Math.floor(new Date(m.deleted_at).getTime() / 1000)}:f>`
                };
            });

            const actionRows = [];
            // Sadece tek mesaja sigmadiginda (>8 mesaj) indirme butonunu goster
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
                navRow: createSorguMenu(targetId, 'sorgu_deleted'),
                actionRows,
                showSocials: false
            });
            return interaction.update(payload);
        }
    } catch (err) {
        console.error('[Sorgu] Select handler hatasi:', err);
        const errPayload = buildModBResponse({
            title: 'Sistem Hatasi',
            textLines: ['Sorgu sirasinda bir hata olustu.'],
            color: COLORS.ERROR
        });
        return interaction.update(errPayload).catch(() => {});
    } finally {
        if (conn) conn.release();
    }
}

async function handleExport(interaction, exportType, targetId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        const userTag = targetUser ? `${targetUser.username} (${targetUser.tag})` : targetId;

        let filename = '';
        let txtContent = '';

        if (exportType === 'warns' || exportType === 'sicil') {
            filename = `${targetId}-uyarilar.txt`;
            const rows = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            txtContent += `UYARI GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Uyari Kaydi: ${rows.length}\n`;
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
            filename = `${targetId}-ceza-gecmisi.txt`;
            const warns = await conn.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [interaction.guild.id, targetId]);
            const mutes = await conn.query('SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [interaction.guild.id, targetId]);
            txtContent += `CEZA GECMISI DOSYASI: ${userTag} (${targetId})\n`;
            txtContent += `Toplam Uyari: ${warns.length} | Toplam Susturma: ${mutes.length}\n`;
            txtContent += `====================================================\n\n`;
            txtContent += `--- UYARILAR ---\n`;
            for (const r of warns) {
                const date = new Date(r.created_at).toLocaleString('tr-TR');
                txtContent += `[Uyari #${r.id}] Durum: ${r.is_active ? 'AKTIF' : 'PASIF'} | Tarih: ${date} | Yetkili: ${r.moderator_id || 'Sistem'}\nSebep: ${r.reason || 'Belirtilmemis'}\n`;
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
            txtContent += `Toplam Ticket Sayisi: ${rows.length}\n`;
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

        if (!txtContent || txtContent.trim().length === 0) {
            const emptyPayload = buildModBResponse({
                title: 'Bilgi',
                textLines: ['Kayitli veri bulunamadi.']
            });
            return interaction.reply({ ...emptyPayload, flags: MessageFlags.Ephemeral });
        }

        const attachment = new AttachmentBuilder(Buffer.from(txtContent, 'utf-8'), { name: filename });
        const successPayload = buildModBResponse({
            title: 'Disa Aktarim Basarili',
            textLines: [`**${userTag}** kullanicisina ait **${exportType.toUpperCase()}** dökümü tarafiniza dosya formatinda aktarilmistir:`],
            color: COLORS.SUCCESS
        });
        successPayload.files = [attachment];
        return interaction.reply({ ...successPayload, flags: MessageFlags.Ephemeral });
    } catch (err) {
        console.error('[Export Handler] Hata:', err);
        const errPayload = buildModBResponse({
            title: 'Sistem Hatasi',
            textLines: ['Dosya aktarimi sirasinda hata olustu.'],
            color: COLORS.ERROR
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral }).catch(() => {});
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { createSorguMenu, handleSorguSelect, handleExport, handleSicilExport: handleExport };
