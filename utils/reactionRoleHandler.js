const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

async function handleReactionRoles(interaction) {
    const { customId } = interaction;

    // 1. Panel Oluşturma (Modal Submit)
    if (customId === 'rr_create_panel_modal') {
        const title = interaction.fields.getTextInputValue('panel_title');
        const desc = interaction.fields.getTextInputValue('panel_desc');
        const modeInput = interaction.fields.getTextInputValue('panel_mode')?.toLowerCase();
        const mode = (modeInput === 'hayır' || modeInput === 'hayir') ? 'single' : 'multiple';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

        let conn;
        try {
            conn = await db.pool.getConnection();
            const result = await conn.query(
                "INSERT INTO reaction_role_panels (guild_id, channel_id, title, description, mode, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                [interaction.guild.id, interaction.channel.id, title, desc || null, mode, interaction.user.id]
            );
            const panelId = result.insertId;

            // Paneli kanala gönder (Şu an seçenek yok)
            const panelMsg = createContainerMessage(title, desc || 'Henüz bir rol eklenmedi.', '#5865F2');
            const message = await interaction.channel.send({ ...panelMsg, flags: MessageFlags.IsComponentsV2 });

            // Mesaj ID'sini kaydet
            await conn.query("UPDATE reaction_role_panels SET message_id = ? WHERE id = ?", [message.id, panelId]);

            await interaction.editReply(createContainerMessage('Başarılı', `<:mono:${MONO_EMOJIS.check || '1531752495292878858'}> Panel oluşturuldu! ID: **${panelId}**\nArtık \`/buton-rol secenek-ekle\` ile bu panele rol ekleyebilirsiniz.`, '#57F287', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
    }

    // 2. Rol Seçimi (Select Menu) - Panele Rol Ekleme Adımı 1
    if (customId.startsWith('rr_add_role_')) {
        const panelId = customId.split('_')[3];
        const roleId = interaction.values[0]; // Kullanıcının seçtiği rol

        // Seçim menüsüne cevap olarak bir Modal açarak Buton Detaylarını (Emoji vb) isteyeceğiz
        const modal = new ModalBuilder()
            .setCustomId(`rr_config_modal_${panelId}_${roleId}`)
            .setTitle('Rol Butonu Ayarları');

        const labelInput = new TextInputBuilder()
            .setCustomId('btn_label')
            .setLabel('Buton Üzerindeki Yazı')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(80)
            .setRequired(true);

        const emojiInput = new TextInputBuilder()
            .setCustomId('btn_emoji')
            .setLabel('Emoji ID veya Özel Karakter (Opsiyonel)')
            .setPlaceholder('Örn: parti emojisi veya 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(60)
            .setRequired(false);

        const styleInput = new TextInputBuilder()
            .setCustomId('btn_style')
            .setLabel('Stil (Mavi, Gri, Yeşil, Kırmızı)')
            .setPlaceholder('Mavi')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(labelInput),
            new ActionRowBuilder().addComponents(emojiInput),
            new ActionRowBuilder().addComponents(styleInput)
        );

        await interaction.showModal(modal);
    }

    // 3. Buton Config (Modal Submit) - Panele Rol Ekleme Adımı 2
    if (customId.startsWith('rr_config_modal_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const parts = customId.split('_');
        const panelId = parts[3];
        const roleId = parts[4];

        const label = interaction.fields.getTextInputValue('btn_label');
        const emoji = interaction.fields.getTextInputValue('btn_emoji');
        let styleStr = interaction.fields.getTextInputValue('btn_style')?.toLowerCase();
        
        let styleInt = ButtonStyle.Primary;
        if (styleStr === 'gri') styleInt = ButtonStyle.Secondary;
        if (styleStr === 'yeşil' || styleStr === 'yesil') styleInt = ButtonStyle.Success;
        if (styleStr === 'kırmızı' || styleStr === 'kirmizi') styleInt = ButtonStyle.Danger;

        let conn;
        try {
            conn = await db.pool.getConnection();
            const panels = await conn.query("SELECT * FROM reaction_role_panels WHERE id = ?", [panelId]);
            if (panels.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Panel bulunamadı.', '#ED4245', [], [], false, true));
            const panel = panels[0];

            await conn.query(
                "INSERT INTO reaction_role_options (panel_id, role_id, label, emoji, style) VALUES (?, ?, ?, ?, ?)",
                [panelId, roleId, label, emoji || null, styleInt]
            );

            // Paneli yeniden oluştur (Re-render)
            await reRenderPanel(interaction.client, conn, panel);

            await interaction.editReply(createContainerMessage('Başarılı', `Rol panele eklendi ve panel güncellendi!`, '#57F287', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
    }

    // 4. Kullanıcının Butona/Menüye Tıklaması (Tepki Rolü Alma/Bırakma)
    if (customId.startsWith('rr_toggle_') || customId.startsWith('rr_select_') || customId === 'rr_panel_select') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        // rr_panel_select durumunda seçenek ID'si interaction.values[0] içindedir
        const optionId = customId === 'rr_panel_select' ? interaction.values[0] : customId.split('_')[2];

        let conn;
        try {
            conn = await db.pool.getConnection();
            const options = await conn.query("SELECT * FROM reaction_role_options WHERE id = ?", [optionId]);
            if (options.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Bu seçenek artık sistemde bulunmuyor.', '#ED4245', [], [], false, true));
            
            const option = options[0];
            const panels = await conn.query("SELECT * FROM reaction_role_panels WHERE id = ?", [option.panel_id]);
            if (panels.length === 0) return;
            const panel = panels[0];

            const member = interaction.member;

            // requires_role_id kısıtı: bu role sahip olmayanlar alamaz
            if (option.requires_role_id && !member.roles.cache.has(option.requires_role_id)) {
                return interaction.editReply(createContainerMessage('Kısıtlı Rol', `<:mono:${MONO_EMOJIS.lock || '1531752487067975963'}> Bu rolü almak için <@&${option.requires_role_id}> rolüne sahip olmanız gerekiyor.`, '#FEE75C', [], [], false, true));
            }

            // max_uses kısıtı: kota dolduysa verme
            if (option.max_uses !== null && option.max_uses !== undefined && Number(option.current_uses) >= Number(option.max_uses)) {
                return interaction.editReply(createContainerMessage('Kota Doldu', `<:mono:${MONO_EMOJIS.cross || '1531752498509910199'}> Bu rolün dağıtım kotası dolmuş (${option.max_uses}/${option.max_uses}).`, '#ED4245', [], [], false, true));
            }

            // Rol paketi rollerini getir (tek buton = birden fazla rol)
            const packs = await conn.query("SELECT role_id FROM reaction_role_packs WHERE option_id = ?", [option.id]);
            const roleIds = [option.role_id, ...packs.map(p => p.role_id)];

            // Ana rolü kontrol et
            const mainRole = interaction.guild.roles.cache.get(option.role_id);
            if (!mainRole) {
                return interaction.editReply(createContainerMessage('Hata', 'Verilecek rol sunucuda bulunamadı (silinmiş olabilir).', '#ED4245', [], [], false, true));
            }

            const hasMain = member.roles.cache.has(mainRole.id);
            const packRoles = roleIds.filter(id => id !== option.role_id).map(id => interaction.guild.roles.cache.get(id)).filter(Boolean);

            if (hasMain) {
                // Rolü (ve paketi) al
                await member.roles.remove([mainRole, ...packRoles].map(r => r.id));
                await interaction.editReply(createContainerMessage('Başarılı', `<:mono:${MONO_EMOJIS.minus || '1531752499931779082'}> <@&${mainRole.id}> rolü sizden alındı.${packRoles.length > 0 ? ` (Paket: ${packRoles.map(r => `<@&${r.id}>`).join(', ')})` : ''}`, '#5865F2', [], [], false, true));
            } else {
                // Eğer Single Mode ise, paneldeki diğer rolleri temizle
                if (panel.mode === 'single') {
                    const allOptions = await conn.query("SELECT role_id FROM reaction_role_options WHERE panel_id = ?", [panel.id]);
                    const roleIdsToRemove = allOptions.map(o => o.role_id).filter(id => id !== option.role_id && member.roles.cache.has(id));
                    if (roleIdsToRemove.length > 0) {
                        await member.roles.remove(roleIdsToRemove);
                    }
                }
                
                // Rolü ve paketi ver
                await member.roles.add([mainRole, ...packRoles].map(r => r.id));
                await interaction.editReply(createContainerMessage('Başarılı', `<:mono:${MONO_EMOJIS.plus || '1531752487067975963'}> <@&${mainRole.id}> rolü size verildi.${packRoles.length > 0 ? ` (Paket: ${packRoles.map(r => `<@&${r.id}>`).join(', ')})` : ''}`, '#57F287', [], [], false, true));
                try { require('./achievements').trackRoleTake(interaction.guild.id, interaction.user.id, member).catch(() => {}); } catch {}
                
                await conn.query("UPDATE reaction_role_options SET current_uses = current_uses + 1 WHERE id = ?", [option.id]);
            }
        } catch (error) {
            console.error('Role toggle error:', error);
            await interaction.editReply(createContainerMessage('Hata', 'Rol işleminiz gerçekleştirilemedi. Lütfen botun yetkilerinin rollerin üzerinde olduğundan emin olun.', '#ED4245', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // 5. Panel Silme (Onay Sonrası)
    if (customId === 'rr_cancel') {
        await interaction.deferUpdate();
        return interaction.editReply({ ...createContainerMessage('İptal Edildi', 'İşlem iptal edildi.', '#ED4245'), components: [] }).catch(() => {});
    }

    if (customId.startsWith('rr_delete_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const panelId = customId.split('_')[2];

        let conn;
        try {
            conn = await db.pool.getConnection();
            const panels = await conn.query("SELECT * FROM reaction_role_panels WHERE id = ? AND guild_id = ?", [panelId, interaction.guild.id]);
            if (panels.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Panel bulunamadı.', '#ED4245', [], [], false, true));
            const panel = panels[0];

            // Panel mesajını kanaldan sil (varsa)
            if (panel.message_id) {
                const channel = interaction.client.channels.cache.get(panel.channel_id);
                if (channel) {
                    await channel.messages.fetch(panel.message_id).then(m => m.delete()).catch(() => {});
                }
            }

            // DB'den sil (cascade options + packs)
            await conn.query("DELETE FROM reaction_role_panels WHERE id = ?", [panelId]);

            await interaction.editReply(createContainerMessage('Panel Silindi', `<:mono:${MONO_EMOJIS.check || '1531752495292878858'}> **"${panel.title}"** paneli ve tüm seçenekleri başarıyla silindi.`, '#57F287', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // 6. Rol Paketi Ekleme (RoleSelect Submit)
    if (customId.startsWith('rr_pack_add_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const optionId = customId.split('_')[3];
        const roleIds = interaction.values;

        let conn;
        try {
            conn = await db.pool.getConnection();
            const opts = await conn.query(
                "SELECT o.*, p.title FROM reaction_role_options o JOIN reaction_role_panels p ON o.panel_id = p.id WHERE o.id = ? AND p.guild_id = ?",
                [optionId, interaction.guild.id]
            );
            if (opts.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Seçenek bulunamadı.', '#ED4245', [], [], false, true));

            // Mevcut paketi temizle, yenisini ekle
            await conn.query("DELETE FROM reaction_role_packs WHERE option_id = ?", [optionId]);
            for (const roleId of roleIds) {
                await conn.query("INSERT INTO reaction_role_packs (option_id, role_id) VALUES (?, ?)", [optionId, roleId]);
            }

            await interaction.editReply(createContainerMessage('Paket Eklendi', `<:mono:${MONO_EMOJIS.check || '1531752495292878858'}> **"${opts[0].title}"** panelindeki \`${opts[0].label}\` butonuna **${roleIds.length}** rol eklendi.\nBu butona basan kişi tüm bu rolleri aynı anda alacak.`, '#57F287', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
        return;
    }
}

async function reRenderPanel(client, conn, panel) {
    const channel = client.channels.cache.get(panel.channel_id);
    if (!channel) return;
    const message = await channel.messages.fetch(panel.message_id).catch(() => null);
    if (!message) return;

    const options = await conn.query("SELECT * FROM reaction_role_options WHERE panel_id = ? ORDER BY id ASC", [panel.id]);

    // Rol paketlerini de çek (her seçenek için)
    const packMap = {};
    if (options.length > 0) {
        const ids = options.map(o => o.id);
        const packs = await conn.query(`SELECT * FROM reaction_role_packs WHERE option_id IN (${ids.join(',')})`);
        for (const p of packs) {
            if (!packMap[p.option_id]) packMap[p.option_id] = [];
            packMap[p.option_id].push(p.role_id);
        }
    }

    let desc = panel.description || 'Lütfen almak istediğiniz rolleri aşağıdan seçin.';

    // Rol paketi olan seçeneklerin bilgisini panele işle
    const packOptions = options.filter(o => packMap[o.id] && packMap[o.id].length > 0);
    if (packOptions.length > 0) {
        desc += '\n\n**Rol Paketleri:**\n';
        for (const o of packOptions) {
            const roles = packMap[o.id].map(id => `<@&${id}>`).join(', ');
            desc += `• **${o.label}** → ${roles}\n`;
        }
    }

    const actionRows = [];

    if (options.length <= 25) {
        // BUTON MODU: max 5 ActionRow, her biri max 5 Buton
        let currentRow = new ActionRowBuilder();
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const btn = new ButtonBuilder()
                .setCustomId(`rr_toggle_${opt.id}`)
                .setLabel(opt.label.substring(0, 80))
                .setStyle(parseInt(opt.style) || ButtonStyle.Primary);

            if (opt.emoji) {
                btn.setEmoji(opt.emoji);
            }

            currentRow.addComponents(btn);

            if (currentRow.components.length === 5 || i === options.length - 1) {
                actionRows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        }
    } else {
        // SELECT MENU MODU: 25'ten fazla seçenek varsa otomatik dropdown'a geç
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('rr_panel_select')
            .setPlaceholder('Almak istediğiniz rolü seçin...')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options.slice(0, 25).map(opt => ({
                label: opt.label.substring(0, 100),
                value: String(opt.id),
                ...(opt.emoji ? { emoji: opt.emoji } : {})
            })));

        actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    const panelMsg = createContainerMessage(panel.title, desc, '#5865F2', actionRows, [], false);
    await message.edit({ ...panelMsg, flags: MessageFlags.IsComponentsV2 });
}

module.exports = {
    handleReactionRoles
};
