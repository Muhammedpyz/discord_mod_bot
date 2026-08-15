const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
    MessageFlags
} = require('discord.js');
const { pool, updateConfigCache } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

// In-memory cache for ultra-fast instant responses
const autoroleMemoryCache = new Map();

async function ensureAutoroleTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS autorole_config (
                guild_id VARCHAR(25) PRIMARY KEY,
                user_role_id VARCHAR(25) NULL,
                bot_role_id VARCHAR(25) NULL,
                channel_id VARCHAR(25) NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error('[AutoRole DB Init Err]:', err.message);
    } finally {
        if (conn) conn.release();
    }
}

// Run once at load time
ensureAutoroleTable().catch(() => {});

async function getAutoroleConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM autorole_config WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            autoroleMemoryCache.set(guildId, rows[0]);
            return rows[0];
        }

        const gRows = await conn.query('SELECT autorole_id FROM guild_config WHERE guild_id = ?', [guildId]);
        const fallbackRole = gRows.length > 0 ? gRows[0].autorole_id : null;

        await conn.query('INSERT INTO autorole_config (guild_id, user_role_id, is_enabled) VALUES (?, ?, TRUE) ON DUPLICATE KEY UPDATE is_enabled = is_enabled', [guildId, fallbackRole]);
        const newObj = {
            guild_id: guildId,
            user_role_id: fallbackRole,
            bot_role_id: null,
            channel_id: null,
            is_enabled: 1
        };
        autoroleMemoryCache.set(guildId, newObj);
        return newObj;
    } catch (err) {
        console.error('getAutoroleConfig error:', err);
        return autoroleMemoryCache.get(guildId) || { guild_id: guildId, user_role_id: null, bot_role_id: null, channel_id: null, is_enabled: 0 };
    } finally {
        if (conn) conn.release();
    }
}

// 1. MAIN PANEL VIEW (Super Clean: Status card + 3 buttons)
function renderAutorolePanel(guild, config) {
    const eSettings = getMonoEmoji('settings') || getMonoEmoji('gear');
    const eUser = getMonoEmoji('user');
    const eRobot = getMonoEmoji('robot') || getMonoEmoji('bot');
    const eChannel = getMonoEmoji('channel') || getMonoEmoji('message');
    const eStatus = getMonoEmoji('status') || getMonoEmoji('settings');
    const eCheck = getMonoEmoji('check') || getMonoEmoji('verify');
    const eCross = getMonoEmoji('cross') || getMonoEmoji('delete');

    const isEnabled = config && (config.is_enabled === 1 || config.is_enabled === true);
    const userRoleStr = config && config.user_role_id ? `<@&${config.user_role_id}>` : '`Ayarlanmadı`';
    const botRoleStr = config && config.bot_role_id ? `<@&${config.bot_role_id}>` : '`Ayarlanmadı`';
    const channelStr = config && config.channel_id ? `<#${config.channel_id}>` : '`Ayarlanmadı (Sessiz)`';
    const statusStr = isEnabled ? `${eCheck} **Aktif**` : `${eCross} **Pasif**`;

    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eSettings} Otorol Yönetim Paneli\nSunucuya yeni katılan üyelere ve botlara otomatik verilecek rolleri tek ekrandan yönetin.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Info details
    const infoText = [
        `» ${eUser} **Kullanıcı Rolü** > ${userRoleStr}`,
        `» ${eRobot} **Bot Rolü** > ${botRoleStr}`,
        `» ${eChannel} **Bildirim Kanalı** > ${channelStr}`,
        `» ${eStatus} **Sistem Durumu** > ${statusStr}`
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(infoText)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Footer
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# ℹ️ Sunucuya katılan yeni üyeler ve botlar belirlenen rolleri otomatik olarak alır.')
    );

    // 4. Action Buttons (Kurulum, Aç/Kapat, Sıfırla)
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('autorole_btn_open_setup')
            .setLabel('Kurulum / Ayarla')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('autorole_btn_toggle')
            .setLabel(isEnabled ? 'Sistemi Kapat' : 'Sistemi Aç')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('autorole_btn_reset')
            .setLabel('Sıfırla')
            .setStyle(ButtonStyle.Secondary)
    );

    if (MONO_EMOJIS.settings || MONO_EMOJIS.gear) btnRow.components[0].setEmoji(MONO_EMOJIS.settings || MONO_EMOJIS.gear);
    if (MONO_EMOJIS.refresh || MONO_EMOJIS.cycle) btnRow.components[2].setEmoji(MONO_EMOJIS.refresh || MONO_EMOJIS.cycle);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, btnRow]
    };
}

// 2. UNIFIED SETUP VIEW (2 Roles + 1 Channel in One Screen!)
function renderAutoroleSetupView(config) {
    const eSettings = getMonoEmoji('settings') || getMonoEmoji('gear');
    const eUser = getMonoEmoji('user');
    const eRobot = getMonoEmoji('robot') || getMonoEmoji('bot');
    const eChannel = getMonoEmoji('channel') || getMonoEmoji('message');

    const userRoleStr = config && config.user_role_id ? `<@&${config.user_role_id}>` : '`Ayarlanmadı`';
    const botRoleStr = config && config.bot_role_id ? `<@&${config.bot_role_id}>` : '`Ayarlanmadı`';
    const channelStr = config && config.channel_id ? `<#${config.channel_id}>` : '`Ayarlanmadı (Sessiz)`';

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eSettings} Otorol Hızlı Kurulum Ekranı\nAşağıdaki açılır menülerden kullanıcı rolünü, bot rolünü ve bildirim kanalını seçin.\n\n» ${eUser} **Kullanıcı Rolü:** ${userRoleStr}\n» ${eRobot} **Bot Rolü:** ${botRoleStr}\n» ${eChannel} **Bildirim Kanalı:** ${channelStr}`)
    );

    // Dropdown 1: Kullanıcı Rolü
    const rowUser = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('autorole_sel_user_role')
            .setPlaceholder(config && config.user_role_id ? '👤 Kullanıcı Rolü Ayarlandı (Değiştir)' : '👤 1. Kullanıcı Rolünü Seçin')
    );

    // Dropdown 2: Bot Rolü
    const rowBot = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('autorole_sel_bot_role')
            .setPlaceholder(config && config.bot_role_id ? '🤖 Bot Rolü Ayarlandı (Değiştir)' : '🤖 2. Bot Rolünü Seçin')
    );

    // Dropdown 3: Bildirim Kanalı
    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('autorole_sel_channel')
            .setPlaceholder(config && config.channel_id ? '📢 Bildirim Kanalı Ayarlandı (Değiştir)' : '📢 3. Bildirim Kanalını Seçin')
            .addChannelTypes(ChannelType.GuildText)
    );

    // Back / Done Button
    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('autorole_btn_back')
            .setLabel('Kaydet & Ana Panele Dön')
            .setStyle(ButtonStyle.Success)
    );

    if (MONO_EMOJIS.check || MONO_EMOJIS.verify) rowBack.components[0].setEmoji(MONO_EMOJIS.check || MONO_EMOJIS.verify);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container, rowUser, rowBot, rowChannel, rowBack]
    };
}

async function handleAutoroleInteractions(interaction) {
    // CRITICAL: IMMEDIATELY DEFER ON LINE 1 BEFORE ANY ASYNC/DB WORK!
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (err) {
        return;
    }

    const { customId, guildId } = interaction;
    let conn;

    try {
        conn = await pool.getConnection();

        // 1. Navigation Handlers
        if (customId === 'autorole_btn_open_setup') {
            const config = await getAutoroleConfig(guildId);
            const view = renderAutoroleSetupView(config);
            return await interaction.editReply(view).catch(() => {});
        }

        if (customId === 'autorole_btn_back') {
            const config = await getAutoroleConfig(guildId);
            const view = renderAutorolePanel(interaction.guild, config);
            return await interaction.editReply(view).catch(() => {});
        }

        // 2. Select Menu Handlers Inside Setup View
        if (customId === 'autorole_sel_user_role') {
            const roleId = interaction.values[0];
            await conn.query(`
                INSERT INTO autorole_config (guild_id, user_role_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE user_role_id = ?
            `, [guildId, roleId, roleId]);

            await conn.query('UPDATE guild_config SET autorole_id = ? WHERE guild_id = ?', [roleId, guildId]);
            updateConfigCache(guildId, 'autorole_id', roleId);

            const updatedConfig = await getAutoroleConfig(guildId);
            const view = renderAutoroleSetupView(updatedConfig);
            return await interaction.editReply(view).catch(() => {});
        }

        if (customId === 'autorole_sel_bot_role') {
            const roleId = interaction.values[0];
            await conn.query(`
                INSERT INTO autorole_config (guild_id, bot_role_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE bot_role_id = ?
            `, [guildId, roleId, roleId]);

            const updatedConfig = await getAutoroleConfig(guildId);
            const view = renderAutoroleSetupView(updatedConfig);
            return await interaction.editReply(view).catch(() => {});
        }

        if (customId === 'autorole_sel_channel') {
            const channelId = interaction.values[0];
            await conn.query(`
                INSERT INTO autorole_config (guild_id, channel_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE channel_id = ?
            `, [guildId, channelId, channelId]);

            const updatedConfig = await getAutoroleConfig(guildId);
            const view = renderAutoroleSetupView(updatedConfig);
            return await interaction.editReply(view).catch(() => {});
        }

        // 3. Action Buttons on Main Panel
        if (customId === 'autorole_btn_toggle') {
            const current = await getAutoroleConfig(guildId);
            const newState = !(current.is_enabled === 1 || current.is_enabled === true);

            await conn.query(`
                INSERT INTO autorole_config (guild_id, is_enabled)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE is_enabled = ?
            `, [guildId, newState, newState]);

            const updatedConfig = await getAutoroleConfig(guildId);
            const view = renderAutorolePanel(interaction.guild, updatedConfig);
            return await interaction.editReply(view).catch(() => {});
        }

        if (customId === 'autorole_btn_reset') {
            await conn.query('DELETE FROM autorole_config WHERE guild_id = ?', [guildId]);
            await conn.query('UPDATE guild_config SET autorole_id = NULL WHERE guild_id = ?', [guildId]);
            updateConfigCache(guildId, 'autorole_id', null);

            const updatedConfig = await getAutoroleConfig(guildId);
            const view = renderAutorolePanel(interaction.guild, updatedConfig);
            return await interaction.editReply(view).catch(() => {});
        }

    } catch (err) {
        console.error('handleAutoroleInteractions error:', err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    getAutoroleConfig,
    renderAutorolePanel,
    handleAutoroleInteractions
};
