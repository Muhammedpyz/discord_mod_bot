const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { pool } = require('../db');
const { buildModBResponse, MONO_EMOJIS, createContainerMessage } = require('./uiBuilder');

async function getAppConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM staff_applications WHERE guild_id = ?', [guildId]);
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

async function renderDashboard(guildId) {
    let row = await getAppConfig(guildId);
    
    if (!row) {
        row = {
            publish_channel_id: null,
            review_channel_id: null,
            reviewer_roles: null,
            approve_role_id: null,
            panel_text: null,
            q1: null, q2: null, q3: null, q4: null, q5: null,
            is_active: 0
        };
    }

    let qCount = 0;
    if (row.q1) qCount++;
    if (row.q2) qCount++;
    if (row.q3) qCount++;
    if (row.q4) qCount++;
    if (row.q5) qCount++;
    if (qCount === 0) qCount = 3; // Varsayılan

    const eReg = `<:mono:${MONO_EMOJIS.announcement}>`; 
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

    const description = `## ${eReg} **Yetkili Başvuru Yönetimi**
Başvuru kanallarını, soruları, inceleme yetkisini ve onay rolünü tek panelden yönet.

***

${eChan} **Yayın kanalı:** ${txtPub}
${eShield} **İnceleme kanalı:** ${txtRev}
${eRole} **İnceleyici roller:** ${txtRevRoles}
${eRole} **Onay rolü:** ${txtAppr}
${eMsg} **Başvuru soruları:** ${qCount} soru${warningText}`;

    const isReady = row.publish_channel_id && row.review_channel_id && row.reviewer_roles && row.approve_role_id;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('app_setup').setLabel('Kurulum').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('app_text').setLabel('Panel Metni').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('app_questions').setLabel('Sorular').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('app_publish').setLabel('Yayınla').setStyle(ButtonStyle.Success).setDisabled(!isReady),
        new ButtonBuilder().setCustomId('app_close').setLabel('Kapat').setStyle(ButtonStyle.Danger).setDisabled(!isReady || !row.is_active),
        new ButtonBuilder().setCustomId('app_refresh').setLabel('Yenile (Sıfırla)').setStyle(ButtonStyle.Secondary)
    );

    return buildModBResponse({ textLines: [description], actionRows: [row1, row2] });
}

async function handleApplicationInteraction(interaction, action) {
    const guildId = interaction.guild.id;

    // YENILE (RESET)
    if (action === 'app_refresh') {
        try { await interaction.deferUpdate(); } catch(e) { return; }
        let conn;
        try {
            conn = await pool.getConnection();
            const config = await getAppConfig(guildId);
            if (config && config.published_message_id && config.publish_channel_id) {
                const pubChan = await interaction.guild.channels.fetch(config.publish_channel_id).catch(()=>null);
                if (pubChan) {
                    const msg = await pubChan.messages.fetch(config.published_message_id).catch(()=>null);
                    if (msg) await msg.delete().catch(()=>{});
                }
            }
            await conn.query('DELETE FROM staff_applications WHERE guild_id = ?', [guildId]);
        } finally {
            if (conn) conn.release();
        }
        const payload = await renderDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    // KURULUM (SETUP)
    if (action === 'app_setup') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        
        const row1 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('app_sel_pub')
                .setPlaceholder('1) Yayın Kanalı Seç (Panelin gönderileceği kanal)')
                .setChannelTypes([ChannelType.GuildText])
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('app_sel_rev')
                .setPlaceholder('2) İnceleme Kanalı Seç (Başvuruların düşeceği kanal)')
                .setChannelTypes([ChannelType.GuildText])
        );
        const row3 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('app_sel_revroles')
                .setPlaceholder('3) İnceleyici Rolleri Seç (Başvuruyu değerlendirecekler)')
                .setMinValues(1)
                .setMaxValues(5)
        );
        const row4 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('app_sel_appr')
                .setPlaceholder('4) Onay Rolü Seç (Kabul edildiğinde verilecek rol)')
        );
        const row5 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('app_setup_done')
                .setLabel('Geri Dön / Kaydet')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.editReply({
            components: [row1, row2, row3, row4, row5]
        }).catch(()=>{});
        return;
    }

    // SELECT MENU HANDLERS FOR SETUP
    if (action === 'app_sel_pub' || action === 'app_sel_rev' || action === 'app_sel_revroles' || action === 'app_sel_appr') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('INSERT IGNORE INTO staff_applications (guild_id) VALUES (?)', [guildId]);
            
            if (action === 'app_sel_pub') {
                await conn.query('UPDATE staff_applications SET publish_channel_id = ? WHERE guild_id = ?', [interaction.values[0], guildId]);
            } else if (action === 'app_sel_rev') {
                await conn.query('UPDATE staff_applications SET review_channel_id = ? WHERE guild_id = ?', [interaction.values[0], guildId]);
            } else if (action === 'app_sel_revroles') {
                await conn.query('UPDATE staff_applications SET reviewer_roles = ? WHERE guild_id = ?', [JSON.stringify(interaction.values), guildId]);
            } else if (action === 'app_sel_appr') {
                await conn.query('UPDATE staff_applications SET approve_role_id = ? WHERE guild_id = ?', [interaction.values[0], guildId]);
            }
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // SETUP DONE
    if (action === 'app_setup_done') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const payload = await renderDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    // PANEL METNİ
    if (action === 'app_text') {
        const config = await getAppConfig(guildId);
        const modal = new ModalBuilder()
            .setCustomId('app_modal_text')
            .setTitle('Panel Metnini Ayarla');
        
        const input = new TextInputBuilder()
            .setCustomId('panel_content')
            .setLabel('Başvuru panelinde ne yazsın?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(config && config.panel_text ? config.panel_text : 'Sunucumuzda yetkili olmak istiyorsanız aşağıdaki butona tıklayarak başvuru yapabilirsiniz.');

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal).catch(()=>{});
        return;
    }

    // SORULAR
    if (action === 'app_questions') {
        const config = await getAppConfig(guildId);
        const modal = new ModalBuilder()
            .setCustomId('app_modal_q')
            .setTitle('Başvuru Sorularını Ayarla');
        
        const q1 = new TextInputBuilder().setCustomId('q1').setLabel('1. Soru').setStyle(TextInputStyle.Short).setRequired(true)
            .setValue(config && config.q1 ? config.q1 : 'İsminiz ve yaşınız nedir?');
        const q2 = new TextInputBuilder().setCustomId('q2').setLabel('2. Soru').setStyle(TextInputStyle.Short).setRequired(true)
            .setValue(config && config.q2 ? config.q2 : 'Neden yetkili olmak istiyorsunuz?');
        const q3 = new TextInputBuilder().setCustomId('q3').setLabel('3. Soru').setStyle(TextInputStyle.Short).setRequired(true)
            .setValue(config && config.q3 ? config.q3 : 'Günlük aktiflik süreniz nedir?');
        const q4 = new TextInputBuilder().setCustomId('q4').setLabel('4. Soru (İsteğe Bağlı)').setStyle(TextInputStyle.Short).setRequired(false)
            .setValue(config && config.q4 ? config.q4 : '');
        const q5 = new TextInputBuilder().setCustomId('q5').setLabel('5. Soru (İsteğe Bağlı)').setStyle(TextInputStyle.Short).setRequired(false)
            .setValue(config && config.q5 ? config.q5 : '');

        modal.addComponents(
            new ActionRowBuilder().addComponents(q1),
            new ActionRowBuilder().addComponents(q2),
            new ActionRowBuilder().addComponents(q3),
            new ActionRowBuilder().addComponents(q4),
            new ActionRowBuilder().addComponents(q5)
        );
        await interaction.showModal(modal).catch(()=>{});
        return;
    }

    // MODAL SUBMIT HANDLERS
    if (action === 'app_modal_text') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const text = interaction.fields.getTextInputValue('panel_content');
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('INSERT IGNORE INTO staff_applications (guild_id) VALUES (?)', [guildId]);
            await conn.query('UPDATE staff_applications SET panel_text = ? WHERE guild_id = ?', [text, guildId]);
        } finally {
            if (conn) conn.release();
        }
        const payload = await renderDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    if (action === 'app_modal_q') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const q1 = interaction.fields.getTextInputValue('q1');
        const q2 = interaction.fields.getTextInputValue('q2');
        const q3 = interaction.fields.getTextInputValue('q3');
        const q4 = interaction.fields.getTextInputValue('q4');
        const q5 = interaction.fields.getTextInputValue('q5');
        
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('INSERT IGNORE INTO staff_applications (guild_id) VALUES (?)', [guildId]);
            await conn.query('UPDATE staff_applications SET q1=?, q2=?, q3=?, q4=?, q5=? WHERE guild_id = ?', [q1, q2, q3, q4, q5, guildId]);
        } finally {
            if (conn) conn.release();
        }
        const payload = await renderDashboard(guildId);
        await interaction.editReply(payload).catch(()=>{});
        return;
    }

    // YAYINLA
    if (action === 'app_publish') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const config = await getAppConfig(guildId);
        if (!config || !config.publish_channel_id) return;

        const pubChan = await interaction.guild.channels.fetch(config.publish_channel_id).catch(()=>null);
        if (!pubChan) {
            await interaction.followUp({ content: 'Yayın kanalı bulunamadı, ayarları kontrol edin.', ephemeral: true }).catch(()=>{});
            return;
        }

        const panelText = config.panel_text || 'Yetkili Başvurusu\nSunucumuzda yetkili olmak istiyorsanız aşağıdaki butona tıklayarak başvuru yapabilirsiniz.';
        const lines = panelText.split('\n');
        const titleLine = lines[0];
        const restLines = lines.slice(1).join('\n');

        let qCount = 0;
        for (let i = 1; i <= 5; i++) if (config[`q${i}`]) qCount++;

        const finalPanelText = `## <:register:1535662521766383687> ${titleLine}
${restLines}

<:message:1535662170577182791> **Form ${qCount} sorudan oluşur.**
<:shield:1535662335320920134> Cevapların yalnızca başvuruları inceleyen yetkililere gösterilir.
-# Tek seferde yalnızca bir bekleyen başvurun olabilir.`;
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('staff_apply_btn')
                .setLabel('Başvur')
                .setEmoji(MONO_EMOJIS.ticket)
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
                await oldMsg.edit(pubPayload).catch((err)=>{ console.error('app_publish edit err:', err); });
                msgSent = true;
                await interaction.followUp({ content: 'Başvuru paneli mevcut kanalda başarıyla güncellendi!', ephemeral: true }).catch(()=>{});
            }
        }

        let sentMessage;
        if (!msgSent) {
            sentMessage = await pubChan.send(pubPayload).catch((err)=>{ 
                console.error('app_publish send err:', err); 
            });
            if (!sentMessage) {
                await interaction.followUp({ content: 'Yayın kanalına mesaj gönderilemedi. Lütfen kanal yetkilerimi (Mesaj Gönderme) kontrol edin!', ephemeral: true }).catch(()=>{});
                return;
            }
        }

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query('UPDATE staff_applications SET is_active = TRUE WHERE guild_id = ?', [guildId]);
            if (sentMessage) {
                await conn.query('UPDATE staff_applications SET published_message_id = ? WHERE guild_id = ?', [sentMessage.id, guildId]);
            }
        } finally {
            if (conn) conn.release();
        }
        
        await interaction.followUp({ content: 'Başvuru paneli başarıyla yayınlandı!', ephemeral: true }).catch(()=>{});
        const dashPayload = await renderDashboard(guildId);
        await interaction.editReply(dashPayload).catch(()=>{});
        return;
    }

    // KAPAT
    if (action === 'app_close') {
        try { await interaction.deferUpdate(); } catch(e){ return; }
        const config = await getAppConfig(guildId);
        if (!config || !config.publish_channel_id) return;

        const pubChan = await interaction.guild.channels.fetch(config.publish_channel_id).catch(()=>null);
        if (pubChan && config.published_message_id) {
            const oldMsg = await pubChan.messages.fetch(config.published_message_id).catch(()=>null);
            if (oldMsg) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('staff_apply_btn')
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
            await conn.query('UPDATE staff_applications SET is_active = FALSE WHERE guild_id = ?', [guildId]);
        } finally {
            if (conn) conn.release();
        }
        
        const dashPayload = await renderDashboard(guildId);
        await interaction.editReply(dashPayload).catch(()=>{});
        return;
    }

    // BAŞVURU YAPMA (ÜYE)
    if (action === 'staff_apply_btn') {
        const config = await getAppConfig(guildId);
        if (!config || !config.is_active || !config.review_channel_id) {
            return interaction.reply({ content: 'Şu anda başvuru alımları kapalıdır.', ephemeral: true }).catch(()=>{});
        }
        
        const modal = new ModalBuilder()
            .setCustomId('staff_apply_submit')
            .setTitle('Yetkili Başvuru Formu');
            
        const truncate = (str) => str.length > 45 ? str.substring(0, 42) + '...' : str;
        const placeHolder = (str) => str.length > 100 ? str.substring(0, 97) + '...' : str;

        if (config.q1) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel(truncate(config.q1)).setPlaceholder(placeHolder(config.q1)).setStyle(TextInputStyle.Short).setRequired(true)));
        if (config.q2) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel(truncate(config.q2)).setPlaceholder(placeHolder(config.q2)).setStyle(TextInputStyle.Paragraph).setRequired(true)));
        if (config.q3) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel(truncate(config.q3)).setPlaceholder(placeHolder(config.q3)).setStyle(TextInputStyle.Paragraph).setRequired(true)));
        if (config.q4) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel(truncate(config.q4)).setPlaceholder(placeHolder(config.q4)).setStyle(TextInputStyle.Paragraph).setRequired(true)));
        if (config.q5) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5').setLabel(truncate(config.q5)).setPlaceholder(placeHolder(config.q5)).setStyle(TextInputStyle.Paragraph).setRequired(true)));

        await interaction.showModal(modal).catch(err => {
            console.error('showModal error:', err);
            interaction.reply({ content: 'Başvuru formu açılırken bir hata oluştu.', ephemeral: true }).catch(()=>{});
        });
        return;
    }

    // BAŞVURU FORMU GÖNDERME (ÜYE)
    if (action === 'staff_apply_submit') {
        try { await interaction.deferReply({ ephemeral: true }); } catch(e){ return; }
        const config = await getAppConfig(guildId);
        if (!config || !config.review_channel_id) return interaction.editReply({ content: 'Sistem hatası: İnceleme kanalı bulunamadı.' }).catch(()=>{});

        const revChan = await interaction.guild.channels.fetch(config.review_channel_id).catch(()=>null);
        if (!revChan) return interaction.editReply({ content: 'Sistem hatası: İnceleme kanalı geçersiz.' }).catch(()=>{});

        let pingRolesText = '';
        if (config.reviewer_roles) {
            try {
                const arr = JSON.parse(config.reviewer_roles);
                if (arr.length > 0) pingRolesText = arr.map(id => `<@&${id}>`).join(' ') + '\n';
            } catch(e) {}
        }

        const now = Math.floor(Date.now() / 1000);
        
        let answersText = '';
        for (let i = 1; i <= 5; i++) {
            if (config[`q${i}`]) {
                try {
                    const ans = interaction.fields.getTextInputValue(`q${i}`);
                    if (ans) {
                        const formattedAns = ans.split('\n').map(line => `> ${line}`).join('\n');
                        answersText += `### ${i}. ${config[`q${i}`]}\n${formattedAns}\n\n`;
                    }
                } catch(e) {}
            }
        }

        const appBody = `## <:register:1535662521766383687> Yeni Yetkili Başvurusu
### <:user:1535662025232097504> Aday
> **Etiket:** <@${interaction.user.id}>
> **Kullanıcı adı:** [${interaction.user.username}](https://discord.com/users/${interaction.user.id})
> **ID:** \`${interaction.user.id}\`
<:calendar:1535662194992353342> **Gönderilme:** <t:${now}:f> (<t:${now}:R>)
<:info:1535661522431250517> **Durum:** İnceleniyor

${answersText}`;

        const payload = buildModBResponse({
            textLines: [pingRolesText + appBody],
            actionRows: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_accept_${interaction.user.id}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`app_reject_${interaction.user.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
                )
            ]
        });
        
        await revChan.send(payload).catch((err)=>{ console.error('app submit send err:', err); });
        await interaction.editReply({ content: 'Başvurunuz başarıyla yetkililere iletildi. Sonuçlandığında size bilgi verilecektir.' }).catch(()=>{});
        return;
    }

    // BAŞVURU KABUL/RED (YETKİLİ)
    if (action.startsWith('app_accept_') || action.startsWith('app_reject_')) {
        const targetId = action.split('_')[2];
        const isAccept = action.startsWith('app_accept_');
        
        const config = await getAppConfig(guildId);
        if (!config) return interaction.reply({ content: 'Ayar bulunamadı.', ephemeral: true }).catch(()=>{});

        let hasPerm = false;
        if (interaction.member.permissions.has('Administrator')) hasPerm = true;
        else if (config.reviewer_roles) {
            try {
                const arr = JSON.parse(config.reviewer_roles);
                if (arr.some(roleId => interaction.member.roles.cache.has(roleId))) hasPerm = true;
            } catch(e) {}
        }
        
        if (!hasPerm) return interaction.reply({ content: 'Bu başvuruyu inceleme yetkiniz yok.', ephemeral: true }).catch(()=>{});
        
        try { await interaction.deferUpdate(); } catch(e){ return; }

        if (isAccept) {
            const member = await interaction.guild.members.fetch(targetId).catch(()=>null);
            if (member && config.approve_role_id) {
                await member.roles.add(config.approve_role_id, 'Yetkili Başvurusu Onaylandı').catch(()=>{});
            }
            if (member) member.send('Tebrikler! Sunucumuzdaki yetkili başvurunuz **onaylandı** ve yetkiniz verildi.').catch(()=>{});
            
            const msg = interaction.message;
            let oldText = '';
            if (msg && msg.components && msg.components[0] && msg.components[0].components) {
                const textComp = msg.components[0].components.find(c => c.type === 10);
                if (textComp && textComp.content) oldText = textComp.content;
            } else if (msg && msg.content) {
                oldText = msg.content;
            }
            
            if (oldText) {
                oldText = oldText.replace('<:info:1535661522431250517> **Durum:** İnceleniyor', '<:check:1535661522431250517> **Durum:** ✅ ONAYLANDI');
                const newPayload = buildModBResponse({ textLines: [oldText], actionRows: [] });
                await interaction.editReply(newPayload).catch((err)=>{ console.error('app accept err:', err); });
            } else {
                await interaction.editReply({ content: 'Başvuru onaylandı.', components: [] }).catch(()=>{});
            }
        } else {
            const member = await interaction.guild.members.fetch(targetId).catch(()=>null);
            if (member) member.send('Maalesef sunucumuzdaki yetkili başvurunuz **reddedildi**.').catch(()=>{});
            
            const msg = interaction.message;
            let oldText = '';
            if (msg && msg.components && msg.components[0] && msg.components[0].components) {
                const textComp = msg.components[0].components.find(c => c.type === 10);
                if (textComp && textComp.content) oldText = textComp.content;
            } else if (msg && msg.content) {
                oldText = msg.content;
            }
            
            if (oldText) {
                oldText = oldText.replace('<:info:1535661522431250517> **Durum:** İnceleniyor', '<:status:1535661522431250517> **Durum:** ❌ REDDEDİLDİ');
                const newPayload = buildModBResponse({ textLines: [oldText], actionRows: [] });
                await interaction.editReply(newPayload).catch((err)=>{ console.error('app reject err:', err); });
            } else {
                await interaction.editReply({ content: 'Başvuru reddedildi.', components: [] }).catch(()=>{});
            }
        }
        return;
    }
}

module.exports = {
    renderDashboard,
    handleApplicationInteraction,
    getAppConfig
};
