const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { pool } = require('../db');
const { buildModBResponse, MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');

const tempAnswers = new Map();

async function getCreatorConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM creator_applications WHERE guild_id = ?', [guildId]);
        if (rows && rows.length > 0) {
            return rows[0];
        }
        return null;
    } catch (e) {
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function renderCreatorDashboard(guildId) {
    let row = await getCreatorConfig(guildId);
    
    if (!row) {
        row = {
            publish_channel_id: null,
            review_channel_id: null,
            reviewer_roles: null,
            approve_role_id: null,
            panel_text: null,
            q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, q7: null, q8: null, q9: null, q10: null,
            is_active: 0
        };
    }

    let qCount = 0;
    if (row.q1) qCount++;
    if (row.q2) qCount++;
    if (row.q3) qCount++;
    if (row.q4) qCount++;
    if (row.q5) qCount++;
    if (row.q6) qCount++;
    if (row.q7) qCount++;
    if (row.q8) qCount++;
    if (row.q9) qCount++;
    if (row.q10) qCount++;
    if (qCount === 0) qCount = 5; // Varsayılan

    const eReg = `<:mono:${MONO_EMOJIS.clapperboard}>`;
    const eChan = `<:mono:${MONO_EMOJIS.status}>`;
    const eShield = `<:mono:${MONO_EMOJIS.shield}>`;
    const eRole = `<:mono:${MONO_EMOJIS.crown}>`;
    const eMsg = `<:mono:${MONO_EMOJIS.ticket}>`;

    const txtPub = row.publish_channel_id ? `<#${row.publish_channel_id}>` : 'Ayarlanmamış';
    const txtRev = row.review_channel_id ? `<#${row.review_channel_id}>` : 'Ayarlanmamış';
    
    let txtRevRoles = 'Ayarlanmamış';
    if (row.reviewer_roles) {
        try {
            const arr = JSON.parse(row.reviewer_roles);
            if (arr.length > 0) txtRevRoles = arr.map(id => `<@&${id}>`).join(', ');
        } catch(e){}
    }

    const txtAppr = row.approve_role_id ? `<@&${row.approve_role_id}>` : 'Ayarlanmamış';

    let warnings = [];
    if (!row.publish_channel_id) warnings.push('Yayın kanalı ayarlanmamış.');
    if (!row.review_channel_id) warnings.push('İnceleme kanalı ayarlanmamış.');
    if (!row.reviewer_roles) warnings.push('İnceleyici roller ayarlanmamış.');
    if (!row.approve_role_id) warnings.push('Onay rolü ayarlanmamış.');

    let warningText = '';
    if (warnings.length > 0) {
        warningText = `\n\n**Eksik Kurulum Bilgileri:**\n${warnings.join('\n')}`;
    } else {
        warningText = `\n\nSistem yayına hazır. Yayınla butonu ile aktif edebilirsiniz.`;
    }

    const description = `## ${eReg} **İçerik Üreticisi Başvuru Yönetimi**
Başvuru kanallarını, soruları, inceleme yetkisini ve onay rolünü tek panelden yönet.

---SEPARATOR---

${eChan} **Yayın kanalı:** ${txtPub}
${eShield} **İnceleme kanalı:** ${txtRev}
${eRole} **İnceleyici roller:** ${txtRevRoles}
${eRole} **Onay rolü:** ${txtAppr}
${eMsg} **Başvuru soruları:** ${qCount} soru${warningText}`;

    const isReady = row.publish_channel_id && row.review_channel_id && row.reviewer_roles && row.approve_role_id;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('creator_setup').setLabel('Kurulum').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('creator_text').setLabel('Panel Metni').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('creator_questions').setLabel('Sorular').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('creator_publish').setLabel('Yayınla').setStyle(ButtonStyle.Success).setDisabled(!isReady),
        new ButtonBuilder().setCustomId('creator_close').setLabel('Kapat').setStyle(ButtonStyle.Danger).setDisabled(!isReady || !row.is_active),
        new ButtonBuilder().setCustomId('creator_refresh').setLabel('Yenile (Sıfırla)').setStyle(ButtonStyle.Secondary)
    );

    return buildModBResponse({ textLines: [description], actionRows: [row1, row2] });
}

async function finalizeCreatorApplication(interaction, guildId, config, answersJson) {
    let conn;
    try {
        conn = await pool.getConnection();
        const existing = await conn.query('SELECT * FROM creator_pending_apps WHERE guild_id = ? AND user_id = ? AND status = \'pending\'', [guildId, interaction.user.id]);
        if (existing && existing.length > 0) {
            return interaction.followUp(createContainerMessage('', 'Zaten aktif bir başvurunuz var. Önceki başvurunuz onaylanıp reddedilmeden yeni başvuru yapamazsınız.', null, [], [], false, true)).catch(()=>{});
        }
    } finally {
        if (conn) conn.release();
    }

    const revChan = await interaction.guild.channels.fetch(config.review_channel_id).catch(()=>null);
    if (!revChan) return interaction.followUp(createContainerMessage('', 'Sistem hatası: İnceleme kanalı geçersiz.', null, [], [], false, true)).catch(()=>{});

    let pingRolesText = '';
    if (config.reviewer_roles) {
        try {
            const arr = JSON.parse(config.reviewer_roles);
            if (arr.length > 0) pingRolesText = arr.map(id => `<@&${id}>`).join(' ') + '\n';
        } catch(e) {}
    }

    const now = Math.floor(Date.now() / 1000);
    
    let answersText = '';
    answersJson.forEach((qa, idx) => {
        let formattedAns = qa.a;
        if (formattedAns.length > 800) formattedAns = formattedAns.substring(0, 797) + '...';
        formattedAns = formattedAns.split('\n').map(line => `> ${line}`).join('\n');
        answersText += `### ${idx + 1}. ${qa.q}\n${formattedAns}\n\n`;
    });

    const appBody = `## <:mono:${MONO_EMOJIS.clapperboard}> Yeni İçerik Üreticisi Başvurusu
### <:mono:${MONO_EMOJIS.user}> Aday
> **Etiket:** <@${interaction.user.id}>
> **Kullanıcı adı:** [${interaction.user.username}](https://discord.com/users/${interaction.user.id})
> **ID:** \`${interaction.user.id}\`
<:mono:${MONO_EMOJIS.calendar}> **Gönderilme:** <t:${now}:f> (<t:${now}:R>)
<:mono:${MONO_EMOJIS.info}> **Durum:** İnceleniyor

${answersText}`;

    let finalLines = [pingRolesText + appBody];
    if (finalLines[0].length > 4000) finalLines[0] = finalLines[0].substring(0, 3997) + '...';

    const payload = buildModBResponse({
        textLines: finalLines,
        actionRows: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`creator_accept_${interaction.user.id}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`creator_reject_${interaction.user.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
            )
        ]
    });
    
    let sentMsg = null;
    try {
        sentMsg = await revChan.send(payload);
    } catch (err) {
        console.error('creator submit send err:', err);
        await interaction.followUp(createContainerMessage('', `Sistem hatası: Başvuru inceleme kanalına gönderilemedi!\nSebep: \`${err.message || err}\`\nLütfen yetkililere bildirin (kanal yetkileri eksik olabilir).`, null, [], [], false, true)).catch(()=>{});
        return;
    }
    
    if (sentMsg) {
        await pool.query('INSERT INTO creator_pending_apps (guild_id, user_id, message_id, status, created_at, answers) VALUES (?, ?, ?, \'pending\', ?, ?)', [guildId, interaction.user.id, sentMsg.id, Date.now(), JSON.stringify(answersJson)]).catch(()=>{});
    }
    
    await interaction.followUp(createContainerMessage('', 'Başvurunuz başarıyla yetkililere iletildi. Sonuçlandığında size bilgi verilecektir.', null, [], [], false, true)).catch(()=>{});
}

async function handleCreatorInteraction(interaction, action) {
    const guildId = interaction.guild.id;

    // YENILE (RESET)
    if (action === 'creator_refresh') {
        try { await interaction.deferUpdate(); } catch(e) { return; }
        let conn;
        try {
            conn = await pool.getConnection();
            const config = await getCreatorConfig(guildId);
            if (config && config.published_message_id && config.publish_channel_id) {
                const pubChan = await interaction.guild.channels.fetch(config.publish_channel_id).catch(()=>null);
                if (pubChan) {
                    const msg = await pubChan.messages.fetch(config.published_message_id).catch(()=>null);
                    if (msg) await msg.delete().catch(()=>{});
                }
            }
            await conn.query('DELETE FROM creator_applications WHERE guild_id = ?', [guildId]);
        } finally {
            if (conn) conn.release();
        }
        const payload = await renderCreatorDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    // KURULUM (SETUP)
    if (action === 'creator_setup') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        
        const row1 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('creator_sel_pub')
                .setPlaceholder('1) Yayın Kanalı Seç (Panelin gönderileceği kanal)')
                .setChannelTypes([ChannelType.GuildText])
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('creator_sel_rev')
                .setPlaceholder('2) İnceleme Kanalı Seç (Başvuruların düşeceği kanal)')
                .setChannelTypes([ChannelType.GuildText])
        );
        const row3 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('creator_sel_revroles')
                .setPlaceholder('3) İnceleyici Rolleri Seç (Başvuruyu değerlendirecekler)')
                .setMinValues(1)
                .setMaxValues(5)
        );
        const row4 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('creator_sel_appr')
                .setPlaceholder('4) Onay Rolü Seç (Kabul edildiğinde verilecek rol — RVIP+)')
        );
        const row5 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('creator_setup_done')
                .setLabel('Geri Dön / Kaydet')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.editReply({
            components: [row1, row2, row3, row4, row5]
        }).catch(()=>{});
        return;
    }

    // SELECT MENU HANDLERS FOR SETUP
    if (action === 'creator_sel_pub' || action === 'creator_sel_rev' || action === 'creator_sel_revroles' || action === 'creator_sel_appr') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('INSERT IGNORE INTO creator_applications (guild_id) VALUES (?)', [guildId]);
            
            if (action === 'creator_sel_pub') {
                await conn.query('UPDATE creator_applications SET publish_channel_id = ? WHERE guild_id = ?', [interaction.values[0], guildId]);
            } else if (action === 'creator_sel_rev') {
                await conn.query('UPDATE creator_applications SET review_channel_id = ? WHERE guild_id = ?', [interaction.values[0], guildId]);
            } else if (action === 'creator_sel_revroles') {
                await conn.query('UPDATE creator_applications SET reviewer_roles = ? WHERE guild_id = ?', [JSON.stringify(interaction.values), guildId]);
            } else if (action === 'creator_sel_appr') {
                await conn.query('UPDATE creator_applications SET approve_role_id = ? WHERE guild_id = ?', [interaction.values[0], guildId]);
            }
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // SETUP DONE
    if (action === 'creator_setup_done') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const payload = await renderCreatorDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    // PANEL METNİ
    if (action === 'creator_text') {
        const config = await getCreatorConfig(guildId);
        const modal = new ModalBuilder()
            .setCustomId('creator_modal_text')
            .setTitle('Panel Metnini Ayarla');
        
        const input = new TextInputBuilder()
            .setCustomId('panel_content')
            .setLabel('Başvuru panelinde ne yazsın?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(config && config.panel_text ? config.panel_text : 'İçerik Üreticisi Başvurusu\nYouTube veya TikTok platformunda içerik üretiyorsan aşağıdaki butona tıklayarak başvurunu gönderebilirsin.');

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal).catch(()=>{});
        return;
    }

    // SORULAR (ADMIN PANELİ - Discord 5 bileşen limiti nedeniyle 2 grup)
    if (action === 'creator_questions') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const config = await getCreatorConfig(guildId);
        const row = config || {};
        const qTxt = (n) => {
            if (row[`q${n}`]) return row[`q${n}`];
            const defaults = {
                1: 'Hangi platformda içerik üretiyorsun? (YouTube/TikTok)',
                2: 'Kanal/Profil linkini paylaş',
                3: 'Abone/Takipçi sayın kaç?',
                4: 'Ne tür içerikler üretiyorsun?',
                5: 'Neden Türklion\'da içerik üreticisi olmak istiyorsun?',
                6: '', 7: '', 8: '', 9: '', 10: ''
            };
            return defaults[n] || '';
        };
        const description = `## <:mono:${MONO_EMOJIS.question}> Başvuru Sorularını Ayarla

<:mono:${MONO_EMOJIS.arrow_right}> **Soru 1:** ${qTxt(1) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 2:** ${qTxt(2) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 3:** ${qTxt(3) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 4:** ${qTxt(4) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 5:** ${qTxt(5) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 6:** ${qTxt(6) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 7:** ${qTxt(7) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 8:** ${qTxt(8) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 9:** ${qTxt(9) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 10:** ${qTxt(10) || 'Ayarlanmamış'}

Discord her modalda en fazla **5** alan kabul ettiği için sorular iki gruba ayrıldı (1-5 / 6-10).`;

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('creator_q_edit_14').setLabel('Soru 1-5 Düzenle').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.edit),
            new ButtonBuilder().setCustomId('creator_q_edit_57').setLabel('Soru 6-10 Düzenle').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.edit)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('creator_q_back').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left)
        );
        await interaction.editReply(buildModBResponse({ textLines: [description], actionRows: [row1, row2] })).catch(()=>{});
        return;
    }

    // SORU GRUP PANELLERİ
    if (action === 'creator_q_back') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const payload = await renderCreatorDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    if (action === 'creator_q_edit_14' || action === 'creator_q_edit_57') {
        const config = await getCreatorConfig(guildId);
        const group = action === 'creator_q_edit_14' ? 1 : 2;
        const modal = new ModalBuilder()
            .setCustomId(group === 1 ? 'creator_modal_q1' : 'creator_modal_q2')
            .setTitle(group === 1 ? 'Soru 1-5 Düzenle' : 'Soru 6-10 Düzenle');
        
        const defaults = {
            1: 'Hangi platformda içerik üretiyorsun? (YouTube/TikTok)',
            2: 'Kanal/Profil linkini paylaş',
            3: 'Abone/Takipçi sayın kaç?',
            4: 'Ne tür içerikler üretiyorsun?',
            5: 'Neden Türklion\'da içerik üreticisi olmak istiyorsun?',
            6: '', 7: '', 8: '', 9: '', 10: ''
        };
        const mk = (n) => new TextInputBuilder()
            .setCustomId(`q${n}`)
            .setLabel(`${n}. Soru${n >= 4 ? ' (İsteğe Bağlı)' : ''}`)
            .setStyle(n <= 3 ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(n <= 3)
            .setValue(config && config[`q${n}`] ? config[`q${n}`] : (defaults[n] || ''));
        
        const nums = group === 1 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];
        modal.addComponents(nums.map(n => new ActionRowBuilder().addComponents(mk(n))));
        await interaction.showModal(modal).catch(()=>{});
        return;
    }

    // MODAL SUBMIT HANDLERS
    if (action === 'creator_modal_text') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const text = interaction.fields.getTextInputValue('panel_content');
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('INSERT IGNORE INTO creator_applications (guild_id) VALUES (?)', [guildId]);
            await conn.query('UPDATE creator_applications SET panel_text = ? WHERE guild_id = ?', [text, guildId]);
        } finally {
            if (conn) conn.release();
        }
        const payload = await renderCreatorDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    if (action === 'creator_modal_q1' || action === 'creator_modal_q2') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const group = action === 'creator_modal_q1' ? 1 : 2;
        const nums = group === 1 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];
        const vals = {};
        for (const n of nums) vals[`q${n}`] = interaction.fields.getTextInputValue(`q${n}`);
        
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('INSERT IGNORE INTO creator_applications (guild_id) VALUES (?)', [guildId]);
            const sets = nums.map(n => `q${n}=?`).join(', ');
            await conn.query(`UPDATE creator_applications SET ${sets} WHERE guild_id = ?`, [...nums.map(n => vals[`q${n}`]), guildId]);
        } finally {
            if (conn) conn.release();
        }
        const config = await getCreatorConfig(guildId);
        const row = config || {};
        const qTxt = (n) => {
            if (row[`q${n}`]) return row[`q${n}`];
            const defaults = {
                1: 'Hangi platformda içerik üretiyorsun? (YouTube/TikTok)',
                2: 'Kanal/Profil linkini paylaş',
                3: 'Abone/Takipçi sayın kaç?',
                4: 'Ne tür içerikler üretiyorsun?',
                5: 'Neden Türklion\'da içerik üreticisi olmak istiyorsun?',
                6: '', 7: '', 8: '', 9: '', 10: ''
            };
            return defaults[n] || '';
        };
        const description = `## <:mono:${MONO_EMOJIS.question}> Başvuru Sorularını Ayarla

<:mono:${MONO_EMOJIS.arrow_right}> **Soru 1:** ${qTxt(1) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 2:** ${qTxt(2) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 3:** ${qTxt(3) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 4:** ${qTxt(4) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 5:** ${qTxt(5) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 6:** ${qTxt(6) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 7:** ${qTxt(7) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 8:** ${qTxt(8) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 9:** ${qTxt(9) || 'Ayarlanmamış'}
<:mono:${MONO_EMOJIS.arrow_right}> **Soru 10:** ${qTxt(10) || 'Ayarlanmamış'}

Discord her modalda en fazla **5** alan kabul ettiği için sorular iki gruba ayrıldı (1-5 / 6-10).`;

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('creator_q_edit_14').setLabel('Soru 1-5 Düzenle').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.edit),
            new ButtonBuilder().setCustomId('creator_q_edit_57').setLabel('Soru 6-10 Düzenle').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.edit)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('creator_q_back').setLabel('Geri Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left)
        );
        await interaction.editReply(buildModBResponse({ textLines: [description], actionRows: [row1, row2] })).catch(()=>{});
        return;
    }

    // YAYINLA
    if (action === 'creator_publish') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const config = await getCreatorConfig(guildId);
        if (!config || !config.publish_channel_id) return;

        const pubChan = await interaction.guild.channels.fetch(config.publish_channel_id).catch(()=>null);
        if (!pubChan) {
            await interaction.followUp(createContainerMessage('', 'Yayın kanalı bulunamadı, ayarları kontrol edin.', null, [], [], false, true)).catch(()=>{});
            return;
        }

        const panelText = config.panel_text || 'İçerik Üreticisi Başvurusu\nYouTube veya TikTok platformunda içerik üretiyorsan aşağıdaki butona tıklayarak başvurunu gönderebilirsin.';
        const lines = panelText.split('\n');
        const titleLine = lines[0];
        const restLines = lines.slice(1).join('\n');

        let qCount = 0;
        for (let i = 1; i <= 10; i++) if (config[`q${i}`] && config[`q${i}`].trim()) qCount++;

        const finalPanelText = `## <:mono:${MONO_EMOJIS.clapperboard}> ${titleLine}
${restLines}

---SEPARATOR---

<:mono:${MONO_EMOJIS.message_circle}> **Form ${qCount} sorudan oluşur.**
<:mono:${MONO_EMOJIS.shield}> Cevapların yalnızca başvuruları inceleyen yetkililere gösterilir.
-# Tek seferde yalnızca bir bekleyen başvurun olabilir.`;
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('creator_apply_btn')
                .setLabel('Başvur')
                .setEmoji(MONO_EMOJIS.clapperboard)
                .setStyle(ButtonStyle.Primary)
        );

        const pubPayload = buildModBResponse({
            textLines: [finalPanelText],
            actionRows: [row]
        });

        let msgSent = false;
        if (config.published_message_id) {
            const oldMsg = await pubChan.messages.fetch(config.published_message_id).catch(()=>null);
            if (oldMsg) {
                await oldMsg.edit(pubPayload).catch((err)=>{ console.error('creator_publish edit err:', err); });
                msgSent = true;
                await interaction.followUp(createContainerMessage('', 'Başvuru paneli mevcut kanalda başarıyla güncellendi!', null, [], [], false, true)).catch(()=>{});
            }
        }

        let sentMessage;
        if (!msgSent) {
            sentMessage = await pubChan.send(pubPayload).catch((err)=>{ 
                console.error('creator_publish send err:', err); 
            });
            if (!sentMessage) {
                await interaction.followUp(createContainerMessage('', 'Yayın kanalına mesaj gönderilemedi. Lütfen kanal yetkilerimi (Mesaj Gönderme) kontrol edin!', null, [], [], false, true)).catch(()=>{});
                return;
            }
        }

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('UPDATE creator_applications SET is_active = TRUE WHERE guild_id = ?', [guildId]);
            if (sentMessage) {
                await conn.query('UPDATE creator_applications SET published_message_id = ? WHERE guild_id = ?', [sentMessage.id, guildId]);
            }
        } finally {
            if (conn) conn.release();
        }
        
        await interaction.followUp(createContainerMessage('', 'Başvuru paneli başarıyla yayınlandı!', null, [], [], false, true)).catch(()=>{});
        const dashPayload = await renderCreatorDashboard(guildId);
        await interaction.editReply(dashPayload).catch(()=>{});
        return;
    }

    // KAPAT
    if (action === 'creator_close') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const config = await getCreatorConfig(guildId);
        if (!config || !config.publish_channel_id) return;

        const pubChan = await interaction.guild.channels.fetch(config.publish_channel_id).catch(()=>null);
        if (pubChan && config.published_message_id) {
            const oldMsg = await pubChan.messages.fetch(config.published_message_id).catch(()=>null);
            if (oldMsg) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('creator_apply_btn')
                        .setLabel('Başvurular Kapalı')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                await oldMsg.edit({ components: [row] }).catch(()=>{});
            }
        }

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('UPDATE creator_applications SET is_active = FALSE WHERE guild_id = ?', [guildId]);
        } finally {
            if (conn) conn.release();
        }
        
        const dashPayload = await renderCreatorDashboard(guildId);
        await interaction.editReply(dashPayload).catch(()=>{});
        return;
    }

    // BAŞVURU YAPMA (ÜYE) - Discord 5 bileşen limiti: 5+ soruda 2 adım
    if (action === 'creator_apply_btn') {
        const config = await getCreatorConfig(guildId);
        if (!config || !config.is_active || !config.review_channel_id) {
            return interaction.reply(createContainerMessage('', 'Şu anda başvuru alımları kapalıdır.', null, [], [], false, true));
        }
        
        const activeQs = [];
        for (let i = 1; i <= 10; i++) {
            if (config[`q${i}`] && config[`q${i}`].trim()) activeQs.push(i);
        }
        if (activeQs.length === 0) {
            return interaction.reply(createContainerMessage('', 'Sistem hatası: Başvuru formu için henüz hiçbir soru ayarlanmamış. Lütfen yetkililere bildirin.', null, [], [], false, true));
        }
        
        const truncate = (str) => {
            if (!str) return 'Soru';
            str = str.trim();
            if (!str) return 'Soru';
            return str.length > 45 ? str.substring(0, 42) + '...' : str;
        };
        const placeHolder = (str) => {
            if (!str) return 'Lütfen buraya yazın...';
            str = str.trim();
            if (!str) return 'Lütfen buraya yazın...';
            return str.length > 100 ? str.substring(0, 97) + '...' : str;
        };
        const mkInput = (n) => new TextInputBuilder()
            .setCustomId(`q${n}`)
            .setLabel(truncate(config[`q${n}`]))
            .setPlaceholder(placeHolder(config[`q${n}`]))
            .setStyle(n <= 3 ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(true);
        
        const twoStep = activeQs.length > 5;
        const first = activeQs.slice(0, 5);
        const modal = new ModalBuilder()
            .setCustomId(twoStep ? 'creator_apply_step1' : 'creator_apply_submit')
            .setTitle('İçerik Üreticisi Başvuru Formu' + (twoStep ? ' (1/2)' : ''));
        modal.addComponents(first.map(n => new ActionRowBuilder().addComponents(mkInput(n))));
        await interaction.showModal(modal).catch(err => {
            console.error('creator showModal error:', err);
            interaction.reply(createContainerMessage('', 'Başvuru formu açılırken bir hata oluştu.', null, [], [], false, true));
        });
        return;
    }

    // BAŞVURU 2. ADIM (6-7 soru varsa)
    if (action === 'creator_apply_step1') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const config = await getCreatorConfig(guildId);
        const activeQs = [];
        for (let i = 1; i <= 10; i++) {
            if (config && config[`q${i}`] && config[`q${i}`].trim()) activeQs.push(i);
        }
        const first = activeQs.slice(0, 5);
        const rest = activeQs.slice(5);
        const firstAnswers = {};
        for (const n of first) {
            try { firstAnswers[n] = interaction.fields.getTextInputValue(`q${n}`) || ''; } catch(e) { firstAnswers[n] = ''; }
        }
        tempAnswers.set(`${guildId}-${interaction.user.id}`, JSON.stringify({ firstAnswers, rest }));
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('creator_apply_continue').setLabel('Devam Et (2/2)').setStyle(ButtonStyle.Primary)
        );
        await interaction.followUp(createContainerMessage('', 'İlk bölüm kaydedildi. Kalan sorular için **Devam Et** butonuna bas.', null, [row], [], false, true)).catch(()=>{});
        return;
    }

    if (action === 'creator_apply_continue') {
        const config = await getCreatorConfig(guildId);
        if (!config) return;
        const activeQs = [];
        for (let i = 1; i <= 10; i++) {
            if (config[`q${i}`] && config[`q${i}`].trim()) activeQs.push(i);
        }
        const rest = activeQs.slice(5);
        if (rest.length === 0) return;
        const truncate = (str) => {
            if (!str) return 'Soru';
            str = str.trim();
            if (!str) return 'Soru';
            return str.length > 45 ? str.substring(0, 42) + '...' : str;
        };
        const placeHolder = (str) => {
            if (!str) return 'Lütfen buraya yazın...';
            str = str.trim();
            if (!str) return 'Lütfen buraya yazın...';
            return str.length > 100 ? str.substring(0, 97) + '...' : str;
        };
        const modal = new ModalBuilder()
            .setCustomId('creator_apply_submit2')
            .setTitle('İçerik Üreticisi Başvuru Formu (2/2)');
        modal.addComponents(rest.map(n => new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(`q${n}`)
                .setLabel(truncate(config[`q${n}`]))
                .setPlaceholder(placeHolder(config[`q${n}`]))
                .setStyle(n <= 3 ? TextInputStyle.Short : TextInputStyle.Paragraph)
                .setRequired(true)
        )));
        await interaction.showModal(modal).catch(()=>{});
        return;
    }

    // BAŞVURU FORMU GÖNDERME (ÜYE) - TEK ADIM (5 veya daha az soru)
    if (action === 'creator_apply_submit') {
        try { await interaction.deferReply({ ephemeral: true }); } catch(e){ return; }
        const config = await getCreatorConfig(guildId);
        if (!config || !config.review_channel_id) return interaction.followUp(createContainerMessage('', 'Sistem hatası: İnceleme kanalı bulunamadı.', null, [], [], false, true)).catch(()=>{});

        const answersJson = [];
        for (let i = 1; i <= 10; i++) {
            if (config[`q${i}`] && config[`q${i}`].trim()) {
                try {
                    const ans = interaction.fields.getTextInputValue(`q${i}`);
                    if (ans) answersJson.push({ q: config[`q${i}`], a: ans });
                } catch(e) {}
            }
        }
        return finalizeCreatorApplication(interaction, guildId, config, answersJson);
    }

    // BAŞVURU FORMU GÖNDERME (ÜYE) - 2. ADIM (6-7 soru)
    if (action === 'creator_apply_submit2') {
        try { await interaction.deferReply({ ephemeral: true }); } catch(e){ return; }
        const config = await getCreatorConfig(guildId);
        if (!config || !config.review_channel_id) return interaction.followUp(createContainerMessage('', 'Sistem hatası: İnceleme kanalı bulunamadı.', null, [], [], false, true)).catch(()=>{});

        let saved = null;
        try { saved = JSON.parse(tempAnswers.get(`${guildId}-${interaction.user.id}`) || 'null'); } catch(e) {}
        tempAnswers.delete(`${guildId}-${interaction.user.id}`);
        const firstAnswers = (saved && saved.firstAnswers) || {};

        const activeQs = [];
        for (let i = 1; i <= 10; i++) {
            if (config[`q${i}`] && config[`q${i}`].trim()) activeQs.push(i);
        }
        const rest = activeQs.slice(5);
        const answersJson = [];
        for (const n of rest) {
            try {
                const ans = interaction.fields.getTextInputValue(`q${n}`);
                if (ans) answersJson.push({ q: config[`q${n}`], a: ans });
            } catch(e) {}
        }
        for (const n of activeQs.slice(0, 5)) {
            if (firstAnswers[n] && config[`q${n}`]) answersJson.push({ q: config[`q${n}`], a: firstAnswers[n] });
        }
        return finalizeCreatorApplication(interaction, guildId, config, answersJson);
    }

    // BAŞVURU KABUL/RED (YETKİLİ)
    if (action.startsWith('creator_accept_') || action.startsWith('creator_reject_') || action.startsWith('creator_rej_sub_')) {
        let targetId = '';
        if (action.startsWith('creator_accept_')) targetId = action.split('_')[2];
        else if (action.startsWith('creator_reject_')) targetId = action.split('_')[2];
        else if (action.startsWith('creator_rej_sub_')) targetId = action.split('_')[3];

        const isAccept = action.startsWith('creator_accept_');
        const isRejectBtn = action.startsWith('creator_reject_');
        const isRejectSubmit = action.startsWith('creator_rej_sub_');
        
        const config = await getCreatorConfig(guildId);
        if (!config) return interaction.reply(createContainerMessage('', 'Ayar bulunamadı.', null, [], [], false, true));

        let hasPerm = false;
        if (interaction.member.permissions.has('Administrator')) hasPerm = true;
        else if (config.reviewer_roles) {
            try {
                const arr = JSON.parse(config.reviewer_roles);
                if (arr.some(roleId => interaction.member.roles.cache.has(roleId))) hasPerm = true;
            } catch(e) {}
        }
        
        if (!hasPerm) return interaction.reply(createContainerMessage('', 'Bu başvuruyu inceleme yetkiniz yok.', null, [], [], false, true));
        
        if (isRejectBtn) {
            const modal = new ModalBuilder()
                .setCustomId(`creator_rej_sub_${targetId}`)
                .setTitle('Başvuruyu Reddet');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Reddetme Sebebi (Kullanıcıya iletilecek)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000)
                )
            );
            return interaction.showModal(modal).catch(()=>{});
        }

        try { 
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate(); 
        } catch(e){ return; }

        if (isAccept) {
            const member = await interaction.guild.members.fetch(targetId).catch(()=>null);
            if (member && config.approve_role_id) {
                await member.roles.add(config.approve_role_id, 'İçerik Üreticisi Başvurusu Onaylandı').catch(()=>{});
            }
            if (member) member.send(`Tebrikler! **${interaction.guild.name}** sunucusundaki içerik üreticisi başvurunuz **onaylandı** ve rolünüz verildi.`).catch(()=>{});
            await pool.query('UPDATE creator_pending_apps SET status = \'approved\', reviewer_id = ?, review_note = ?, reviewed_at = ? WHERE guild_id = ? AND user_id = ? AND status = \'pending\'', [interaction.user.id, 'Onaylandı', Date.now(), guildId, targetId]).catch(()=>{});
            
            const msg = interaction.message;
            let oldText = '';
            if (msg && msg.components && msg.components[0] && msg.components[0].components) {
                const textComp = msg.components[0].components.find(c => c.type === 10);
                if (textComp && textComp.content) oldText = textComp.content;
            } else if (msg && msg.content) {
                oldText = msg.content;
            }
            
            if (oldText) {
                oldText = oldText.replace(
                    `<:mono:${MONO_EMOJIS.info}> **Durum:** İnceleniyor`, 
                    `<:mono:${MONO_EMOJIS.check}> **Durum:** ONAYLANDI\n<:mono:${MONO_EMOJIS.user}> **İnceleyen:** <@${interaction.user.id}>`
                );
                const newPayload = buildModBResponse({ textLines: [oldText], actionRows: [] });
                await interaction.editReply(newPayload).catch((err)=>{ console.error('creator accept err:', err); });
            } else {
                await interaction.followUp(createContainerMessage('', 'Başvuru onaylandı.', null, [], [], false, true)).catch(()=>{});
            }
        } else if (isRejectSubmit) {
            const reason = interaction.fields.getTextInputValue('reason');
            const member = await interaction.guild.members.fetch(targetId).catch(()=>null);
            if (member) member.send(`Maalesef **${interaction.guild.name}** sunucusundaki içerik üreticisi başvurunuz **reddedildi**.\n**Sebep:** ${reason}`).catch(()=>{});
            await pool.query('UPDATE creator_pending_apps SET status = \'rejected\', reviewer_id = ?, review_note = ?, reviewed_at = ? WHERE guild_id = ? AND user_id = ? AND status = \'pending\'', [interaction.user.id, reason, Date.now(), guildId, targetId]).catch(()=>{});
            
            const msg = interaction.message;
            let oldText = '';
            if (msg && msg.components && msg.components[0] && msg.components[0].components) {
                const textComp = msg.components[0].components.find(c => c.type === 10);
                if (textComp && textComp.content) oldText = textComp.content;
            } else if (msg && msg.content) {
                oldText = msg.content;
            }
            
            if (oldText) {
                oldText = oldText.replace(
                    `<:mono:${MONO_EMOJIS.info}> **Durum:** İnceleniyor`, 
                    `<:mono:${MONO_EMOJIS.cross}> **Durum:** REDDEDİLDİ\n<:mono:${MONO_EMOJIS.user}> **İnceleyen:** <@${interaction.user.id}>\n<:mono:${MONO_EMOJIS.message_circle}> **Sebep:** ${reason}`
                );
                const newPayload = buildModBResponse({ textLines: [oldText], actionRows: [] });
                await interaction.editReply(newPayload).catch((err)=>{ console.error('creator reject err:', err); });
            } else {
                await interaction.followUp(createContainerMessage('', 'Başvuru reddedildi.', null, [], [], false, true)).catch(()=>{});
            }
        }
        return;
    }
}

module.exports = {
    renderCreatorDashboard,
    handleCreatorInteraction,
    getCreatorConfig
};
