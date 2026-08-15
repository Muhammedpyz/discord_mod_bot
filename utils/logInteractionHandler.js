const {
    buildLogMainPanel,
    buildLogChannelsPanel,
    buildLogAssignChannelPanel,
    buildLogEventsPanel,
    buildLogCategoryEventsPanel,
    buildLogIgnoredPanel,
    buildLogDiagnosticPanel,
    buildLogQuickSetupPanel,
    buildLogResetConfirmPanel
} = require('./logSystem');
const {
    setGuildLogChannel,
    setAllGuildLogChannels,
    setGuildLogEvent,
    setAllCategoryEvents,
    addGuildLogIgnored,
    removeGuildLogIgnored,
    setGuildLogSettings,
    resetGuildLogs,
    getCompleteGuildLogState
} = require('../db');
const { LOG_CATEGORIES } = require('./logCatalog');

/**
 * Central Interaction Handler for /log system
 */
async function handleLogInteraction(interaction) {
    // 0ms Defer Update rule
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    const { customId, guildId, guild } = interaction;

    try {
        // --- 1. Ana Menü ve Gezinme Butonları ---
        if (customId === 'log_btn_back_main') {
            const panel = await buildLogMainPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_channels') {
            const panel = await buildLogChannelsPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_events') {
            const panel = await buildLogEventsPanel(guildId);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_ignored') {
            const panel = await buildLogIgnoredPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_diagnostic') {
            const panel = await buildLogDiagnosticPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_quick_setup') {
            const panel = buildLogQuickSetupPanel();
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_reset') {
            const panel = buildLogResetConfirmPanel();
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_reset_confirm') {
            await resetGuildLogs(guildId);
            const panel = await buildLogMainPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        // --- 2. Kategori Kanalları Ayarlama ---
        if (customId === 'log_select_category_for_channel') {
            const selectedCategory = interaction.values?.[0];
            if (selectedCategory) {
                const panel = await buildLogAssignChannelPanel(guildId, selectedCategory, guild);
                return await interaction.editReply(panel);
            }
        }

        if (customId.startsWith('log_assign_ch_')) {
            const categoryId = customId.replace('log_assign_ch_', '');
            const selectedChannelId = interaction.values?.[0];
            if (selectedChannelId) {
                await setGuildLogChannel(guildId, categoryId, selectedChannelId);
            }
            const panel = await buildLogChannelsPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId.startsWith('log_btn_remove_ch_')) {
            const categoryId = customId.replace('log_btn_remove_ch_', '');
            await setGuildLogChannel(guildId, categoryId, null);
            const panel = await buildLogChannelsPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        // --- 3. Olay Açma / Kapatma Kontrolü ---
        if (customId === 'log_select_category_for_events') {
            const selectedCategory = interaction.values?.[0];
            if (selectedCategory) {
                const panel = await buildLogCategoryEventsPanel(guildId, selectedCategory);
                return await interaction.editReply(panel);
            }
        }

        if (customId.startsWith('log_toggle_events_')) {
            const categoryId = customId.replace('log_toggle_events_', '');
            const cat = LOG_CATEGORIES[categoryId];
            if (cat) {
                const enabledValues = new Set(interaction.values || []);
                for (const ev of cat.events) {
                    await setGuildLogEvent(guildId, ev.id, enabledValues.has(ev.id));
                }
                const panel = await buildLogCategoryEventsPanel(guildId, categoryId);
                return await interaction.editReply(panel);
            }
        }

        if (customId.startsWith('log_btn_enable_all_')) {
            const categoryId = customId.replace('log_btn_enable_all_', '');
            await setAllCategoryEvents(guildId, categoryId, true);
            const panel = await buildLogCategoryEventsPanel(guildId, categoryId);
            return await interaction.editReply(panel);
        }

        if (customId.startsWith('log_btn_disable_all_')) {
            const categoryId = customId.replace('log_btn_disable_all_', '');
            await setAllCategoryEvents(guildId, categoryId, false);
            const panel = await buildLogCategoryEventsPanel(guildId, categoryId);
            return await interaction.editReply(panel);
        }

        // --- 4. Yok Sayılanlar (Ignored) Yönetimi ---
        if (customId === 'log_select_ignored_channels') {
            const state = await getCompleteGuildLogState(guildId);
            const selectedChannels = new Set(interaction.values || []);
            // Remove unselected
            for (const chId of state.ignored.channels) {
                if (!selectedChannels.has(chId)) await removeGuildLogIgnored(guildId, 'channel', chId);
            }
            // Add new
            for (const chId of selectedChannels) {
                await addGuildLogIgnored(guildId, 'channel', chId);
            }
            const panel = await buildLogIgnoredPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_select_ignored_roles') {
            const state = await getCompleteGuildLogState(guildId);
            const selectedRoles = new Set(interaction.values || []);
            // Remove unselected
            for (const rId of state.ignored.roles) {
                if (!selectedRoles.has(rId)) await removeGuildLogIgnored(guildId, 'role', rId);
            }
            // Add new
            for (const rId of selectedRoles) {
                await addGuildLogIgnored(guildId, 'role', rId);
            }
            const panel = await buildLogIgnoredPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_select_ignored_users') {
            const state = await getCompleteGuildLogState(guildId);
            const selectedUsers = new Set(interaction.values || []);
            // Remove unselected
            for (const uId of state.ignored.users) {
                if (!selectedUsers.has(uId)) await removeGuildLogIgnored(guildId, 'user', uId);
            }
            // Add new
            for (const uId of selectedUsers) {
                await addGuildLogIgnored(guildId, 'user', uId);
            }
            const panel = await buildLogIgnoredPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        if (customId === 'log_btn_toggle_ignore_bots') {
            const state = await getCompleteGuildLogState(guildId);
            await setGuildLogSettings(guildId, !state.ignoreBots);
            const panel = await buildLogIgnoredPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

        // --- 5. Hızlı Kurulum ---
        if (customId === 'log_select_quick_setup_channel') {
            const selectedChannelId = interaction.values?.[0];
            if (selectedChannelId) {
                await setAllGuildLogChannels(guildId, selectedChannelId);
            }
            const panel = await buildLogMainPanel(guildId, guild);
            return await interaction.editReply(panel);
        }

    } catch (err) {
        console.error('Log interaction handler error:', err);
    }
}

module.exports = {
    handleLogInteraction
};
