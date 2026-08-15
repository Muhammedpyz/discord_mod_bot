const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType,
    MessageFlags
} = require('discord.js');
const { pool } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

async function ensureStaffPanelTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS staff_panel_config (
                guild_id VARCHAR(25) PRIMARY KEY,
                channel_id VARCHAR(25) DEFAULT NULL,
                message_id VARCHAR(25) DEFAULT NULL,
                roles_json TEXT DEFAULT NULL,
                title VARCHAR(255) DEFAULT 'Yetkili Kadromuz:',
                description TEXT DEFAULT 'Sunucumuzun yetkili ekibi ve görev dağılımı aşağıda yer alıyor.',
                is_active BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error('ensureStaffPanelTable error:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function getStaffPanelConfig(guildId) {
    await ensureStaffPanelTable();
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM staff_panel_config WHERE guild_id = ? LIMIT 1', [guildId]);
        return rows[0] || null;
    } catch (err) {
        console.error('getStaffPanelConfig error:', err);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function saveStaffPanelConfig(guildId, data) {
    await ensureStaffPanelTable();
    let conn;
    try {
        conn = await pool.getConnection();
        const rolesJson = typeof data.roles_json === 'string' ? data.roles_json : JSON.stringify(data.roles_json || []);
        await conn.query(`
            INSERT INTO staff_panel_config (guild_id, channel_id, message_id, roles_json, title, description, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                channel_id = VALUES(channel_id),
                message_id = VALUES(message_id),
                roles_json = VALUES(roles_json),
                title = VALUES(title),
                description = VALUES(description),
                is_active = VALUES(is_active)
        `, [
            guildId,
            data.channel_id || null,
            data.message_id || null,
            rolesJson,
            data.title || 'Yetkili Kadromuz:',
            data.description || 'Sunucumuzun yetkili ekibi ve görev dağılımı aşağıda yer alıyor.',
            data.is_active !== undefined ? data.is_active : true
        ]);
    } catch (err) {
        console.error('saveStaffPanelConfig error:', err);
    } finally {
        if (conn) conn.release();
    }
}

function renderStaffSetupPanel(guild, config) {
    const eShield = getMonoEmoji('shield');
    const eGear = getMonoEmoji('settings') || getMonoEmoji('gear');
    const eChannel = getMonoEmoji('channel') || getMonoEmoji('message');
    const eRole = getMonoEmoji('shield') || getMonoEmoji('user');
    const eMessage = getMonoEmoji('message') || getMonoEmoji('file');

    let rolesListText = 'Ayarlanmadı';
    if (config?.roles_json) {
        try {
            const rolesArr = typeof config.roles_json === 'string' ? JSON.parse(config.roles_json) : config.roles_json;
            if (Array.isArray(rolesArr) && rolesArr.length > 0) {
                rolesListText = rolesArr.map(rId => `<@&${rId}>`).join(' ');
            }
        } catch (e) {}
    }

    const channelText = config?.channel_id ? `<#${config.channel_id}>` : 'Ayarlanmadı';
    const isLive = config?.message_id && config?.channel_id && config?.is_active;
    const messageText = isLive ? 'Yayında' : 'Henüz yayınlanmadı';

    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eShield} Yetkili Panosu:\nYetkili rollerini ayrı gruplar halinde gösteren ve değişikliklerde otomatik yenilenen panoyu yönet.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Kurulum Durumu
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### ${eGear} Kurulum Durumu:\n` +
            `» ${eChannel} **Pano Kanalı:** ${channelText}\n` +
            `» ${eRole} **Yetkili Rolleri:** ${rolesListText}\n` +
            `» ${eMessage} **Pano Mesajı:** ${messageText}`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Action Rows (5 Buton)
    // Row 1: Kanal ve Roller + Görünüm
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('staff_btn_roles')
            .setLabel('Kanal ve Roller')
            .setEmoji(MONO_EMOJIS.settings || MONO_EMOJIS.status)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('staff_btn_appearance')
            .setLabel('Görünüm')
            .setEmoji(MONO_EMOJIS.signature || MONO_EMOJIS.ticket)
            .setStyle(ButtonStyle.Secondary)
    );

    // Row 2: Panoyu Yayınla / Panoyu Güncelle
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('staff_btn_publish')
            .setLabel(isLive ? 'Panoyu Güncelle' : 'Panoyu Yayınla')
            .setEmoji(isLive ? (MONO_EMOJIS.refresh || MONO_EMOJIS.status) : (MONO_EMOJIS.file || MONO_EMOJIS.add))
            .setStyle(ButtonStyle.Success)
    );

    // Row 3: Yenile + Sistemi Kaldır
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('staff_btn_refresh')
            .setLabel('Yenile')
            .setEmoji(MONO_EMOJIS.refresh || MONO_EMOJIS.status)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('staff_btn_remove')
            .setLabel('Sistemi Kaldır')
            .setEmoji(MONO_EMOJIS.delete || MONO_EMOJIS.cross)
            .setStyle(ButtonStyle.Danger)
    );

    container.addActionRowComponents(row1, row2, row3);

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 4. Footer
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Üyelerin yetkili rolleri değiştiğinde pano otomatik güncellenir.')
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

function renderStaffRoleSelectionView(guild, config) {
    const eShield = getMonoEmoji('shield');
    const eGear = getMonoEmoji('settings') || getMonoEmoji('gear');
    const eChannel = getMonoEmoji('channel') || getMonoEmoji('message');
    const eRole = getMonoEmoji('shield') || getMonoEmoji('user');

    let rolesListText = 'Henüz rol seçilmedi';
    if (config?.roles_json) {
        try {
            const rolesArr = typeof config.roles_json === 'string' ? JSON.parse(config.roles_json) : config.roles_json;
            if (Array.isArray(rolesArr) && rolesArr.length > 0) {
                rolesListText = rolesArr.map(rId => `<@&${rId}>`).join(' ');
            }
        } catch (e) {}
    }

    const channelText = config?.channel_id ? `<#${config.channel_id}>` : 'Henüz kanal seçilmedi';

    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eShield} Yetkili Panosu — Kanal ve Rol Seçimi:\nAşağıdaki açılır menülerden panonun yayınlanacağı kanalı ve yetkili kadrosunda listelenecek rolleri seçin.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Anlık Seçim Durumu
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### ${eGear} Seçili Ayarlar:\n` +
            `» ${eChannel} **Pano Kanalı:** ${channelText}\n` +
            `» ${eRole} **Seçili Roller:** ${rolesListText}`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Menüler (Kanal Seçim + Rol Seçim)
    const channelRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('staff_sel_channel')
            .setPlaceholder('Pano Kanalını Seçin...')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const roleRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('staff_sel_roles')
            .setPlaceholder('Yetkili Rollerini Seçin (En fazla 20 rol)...')
            .setMinValues(1)
            .setMaxValues(20)
    );

    // 4. Onay ve Geri Dön Butonları
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('staff_btn_back')
            .setLabel('Tamamla ve Ana Panele Dön')
            .setEmoji(MONO_EMOJIS.check || MONO_EMOJIS.add)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('staff_btn_back_cancel')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || MONO_EMOJIS.status)
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(channelRow, roleRow, btnRow);

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Menülerden seçim yaptığınızda ayarlar anında otomatik kaydedilir.')
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

async function renderPublishedStaffBoard(guild, config) {
    const eCrown = getMonoEmoji('crown') || getMonoEmoji('sparkles');
    const eShield = getMonoEmoji('shield');
    const eUser = getMonoEmoji('user');

    const title = config?.title || 'Yetkili Kadromuz:';
    const description = config?.description || 'Sunucumuzun yetkili ekibi ve görev dağılımı aşağıda yer alıyor.';

    let rolesArr = [];
    if (config?.roles_json) {
        try {
            rolesArr = typeof config.roles_json === 'string' ? JSON.parse(config.roles_json) : config.roles_json;
        } catch (e) {}
    }

    await guild.members.fetch().catch(() => {});

    const container = new ContainerBuilder();

    // 1. Header & Description
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eCrown} ${title}\n${description}`)
    );

    const uniqueStaffIds = new Set();

    if (rolesArr.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        for (const roleId of rolesArr) {
            const role = guild.roles.cache.get(roleId);
            if (!role) continue;

            const members = role.members.filter(m => !m.user.bot);
            const memberCount = members.size;

            members.forEach(m => uniqueStaffIds.add(m.id));

            let memberListStr = 'Bu rolde henüz kimse yok.';
            if (memberCount > 0) {
                memberListStr = members.map(m => `<@${m.id}>`).join(' ');
            }

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${eShield} <@&${role.id}> · **${memberCount} kişi**\n» ${eUser} ${memberListStr}`
                )
            );
        }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // Footer
    const nowUnix = Math.floor(Date.now() / 1000);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Toplam ${uniqueStaffIds.size} yetkili · Son güncelleme: <t:${nowUnix}:R>`)
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

async function updatePublishedStaffBoard(guild) {
    try {
        const config = await getStaffPanelConfig(guild.id);
        if (!config || !config.is_active || !config.channel_id || !config.message_id) return;

        const channel = guild.channels.cache.get(config.channel_id) || await guild.channels.fetch(config.channel_id).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(config.message_id).catch(() => null);
        if (!message) return;

        const payload = await renderPublishedStaffBoard(guild, config);
        await message.edit(payload).catch(() => {});
    } catch (err) {
        console.error('updatePublishedStaffBoard error:', err);
    }
}

async function handleStaffPanelButtons(interaction) {
    const customId = interaction.customId;
    const guild = interaction.guild;

    // Görünüm Butonu modal açacağı için deferUpdate yapılmaz
    if (customId !== 'staff_btn_appearance') {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (e) {
            return;
        }
    }

    const config = await getStaffPanelConfig(guild.id) || {};

    // 1. Kanal ve Roller Butonu -> Dropdown / Select Menu Ekranı
    if (customId === 'staff_btn_roles') {
        const selectPayload = renderStaffRoleSelectionView(guild, config);
        return await interaction.editReply(selectPayload);
    }

    // 1.1. Geri Dön Butonu -> Ana Kurulum Paneline Dön
    if (customId === 'staff_btn_back' || customId === 'staff_btn_back_cancel') {
        const mainPayload = renderStaffSetupPanel(guild, config);
        return await interaction.editReply(mainPayload);
    }

    // 2. Görünüm Butonu (Modal açılışı - DOĞRUDAN SHOWMODAL)
    if (customId === 'staff_btn_appearance') {
        const modal = new ModalBuilder()
            .setCustomId('modal_staff_panel_appearance')
            .setTitle('Pano Görünümü');

        const titleInput = new TextInputBuilder()
            .setCustomId('staff_input_title')
            .setLabel('Pano Başlığı')
            .setPlaceholder('Boş bırakırsan hazır başlık kullanılır')
            .setStyle(TextInputStyle.Short)
            .setValue(config.title || 'Yetkili Kadromuz:')
            .setRequired(false);

        const descInput = new TextInputBuilder()
            .setCustomId('staff_input_desc')
            .setLabel('Pano Açıklaması')
            .setPlaceholder('Rol gruplarının üstünde gösterilecek kısa açıklama')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.description || 'Sunucumuzun yetkili ekibi ve görev dağılımı aşağıda yer alıyor.')
            .setMaxLength(600)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );

        return await interaction.showModal(modal);
    }

    // 3. Panoyu Yayınla / Panoyu Güncelle Butonu
    if (customId === 'staff_btn_publish') {
        await interaction.deferUpdate();

        if (!config.channel_id) {
            return await interaction.followUp({
                content: 'Lütfen önce **Kanal ve Roller** butonundan panonun yayınlanacağı kanalı ayarlayın.',
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = guild.channels.cache.get(config.channel_id) || await guild.channels.fetch(config.channel_id).catch(() => null);
        if (!channel) {
            return await interaction.followUp({
                content: 'Ayarlanan pano kanalı bulunamadı. Lütfen kanalı tekrar seçin.',
                flags: MessageFlags.Ephemeral
            });
        }

        const boardPayload = await renderPublishedStaffBoard(guild, config);
        let boardMessage = null;

        if (config.message_id) {
            boardMessage = await channel.messages.fetch(config.message_id).catch(() => null);
        }

        if (boardMessage) {
            await boardMessage.edit(boardPayload);
        } else {
            boardMessage = await channel.send(boardPayload);
            config.message_id = boardMessage.id;
        }

        config.is_active = true;
        await saveStaffPanelConfig(guild.id, config);

        const updatedSetupPayload = renderStaffSetupPanel(guild, config);
        await interaction.editReply(updatedSetupPayload);

        await interaction.followUp({
            content: `Yetkili panosu <#${config.channel_id}> kanalında güncellendi.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // 4. Yenile Butonu
    if (customId === 'staff_btn_refresh') {
        await interaction.deferUpdate();
        await updatePublishedStaffBoard(guild);
        const updatedConfig = await getStaffPanelConfig(guild.id);
        const setupPayload = renderStaffSetupPanel(guild, updatedConfig);
        await interaction.editReply(setupPayload);
        return;
    }

    // 5. Sistemi Kaldır Butonu
    if (customId === 'staff_btn_remove') {
        await interaction.deferUpdate();
        if (config.channel_id && config.message_id) {
            const channel = guild.channels.cache.get(config.channel_id) || await guild.channels.fetch(config.channel_id).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(config.message_id).catch(() => null);
                if (message) await message.delete().catch(() => {});
            }
        }

        config.is_active = false;
        config.channel_id = null;
        config.message_id = null;
        config.roles_json = [];
        await saveStaffPanelConfig(guild.id, config);

        const setupPayload = renderStaffSetupPanel(guild, config);
        await interaction.editReply(setupPayload);

        await interaction.followUp({
            content: 'Yetkili panosu sistemi başarıyla sıfırlandı ve kaldırıldı.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }
}

async function handleStaffPanelSelectMenus(interaction) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    const config = await getStaffPanelConfig(guild.id) || {};

    await interaction.deferUpdate();

    // 1. Kanal Seçim Menüsü
    if (customId === 'staff_sel_channel') {
        if (interaction.values && interaction.values.length > 0) {
            config.channel_id = interaction.values[0];
            await saveStaffPanelConfig(guild.id, config);
        }
        const updatedView = renderStaffRoleSelectionView(guild, config);
        return await interaction.editReply(updatedView);
    }

    // 2. Rol Seçim Menüsü
    if (customId === 'staff_sel_roles') {
        if (interaction.values && interaction.values.length > 0) {
            config.roles_json = interaction.values;
            await saveStaffPanelConfig(guild.id, config);
        }
        const updatedView = renderStaffRoleSelectionView(guild, config);
        return await interaction.editReply(updatedView);
    }
}

async function handleStaffPanelModals(interaction) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    const config = await getStaffPanelConfig(guild.id) || {};

    if (customId === 'modal_staff_panel_appearance') {
        await interaction.deferUpdate();

        const titleVal = interaction.fields.getTextInputValue('staff_input_title');
        const descVal = interaction.fields.getTextInputValue('staff_input_desc');

        config.title = titleVal ? titleVal.trim() : 'Yetkili Kadromuz:';
        config.description = descVal ? descVal.trim() : 'Sunucumuzun yetkili ekibi ve görev dağılımı aşağıda yer alıyor.';

        await saveStaffPanelConfig(guild.id, config);

        const setupPayload = renderStaffSetupPanel(guild, config);
        await interaction.editReply(setupPayload);
        return;
    }
}

module.exports = {
    getStaffPanelConfig,
    saveStaffPanelConfig,
    renderStaffSetupPanel,
    renderStaffRoleSelectionView,
    renderPublishedStaffBoard,
    updatePublishedStaffBoard,
    handleStaffPanelButtons,
    handleStaffPanelSelectMenus,
    handleStaffPanelModals
};
