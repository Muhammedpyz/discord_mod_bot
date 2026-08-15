const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const { pool } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

async function ensurePrefixTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_prefixes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                prefix VARCHAR(10) NOT NULL,
                is_main BOOLEAN DEFAULT FALSE,
                UNIQUE KEY unique_guild_prefix (guild_id, prefix)
            )
        `);
        try {
            await conn.query(`ALTER TABLE guild_prefixes ADD COLUMN is_main BOOLEAN DEFAULT FALSE`);
        } catch (e) {}
    } catch (err) {
        console.error('ensurePrefixTable error:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function getGuildPrefixes(guildId) {
    await ensurePrefixTable();
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT prefix, is_main FROM guild_prefixes WHERE guild_id = ? ORDER BY is_main DESC, id ASC', [guildId]);
        if (!rows || rows.length === 0) {
            return [{ prefix: '/', is_main: true }];
        }
        return rows.map(r => ({ prefix: r.prefix, is_main: Boolean(r.is_main) }));
    } catch (err) {
        console.error('getGuildPrefixes error:', err);
        return [{ prefix: '/', is_main: true }];
    } finally {
        if (conn) conn.release();
    }
}

async function setMainPrefix(guildId, newPrefix) {
    await ensurePrefixTable();
    let conn;
    try {
        conn = await pool.getConnection();
        // Remove is_main from all
        await conn.query('UPDATE guild_prefixes SET is_main = FALSE WHERE guild_id = ?', [guildId]);
        // Insert or update new prefix as is_main
        await conn.query(`
            INSERT INTO guild_prefixes (guild_id, prefix, is_main)
            VALUES (?, ?, TRUE)
            ON DUPLICATE KEY UPDATE is_main = TRUE
        `, [guildId, newPrefix]);
        try {
            const { invalidatePrefixCache } = require('./messageCommandAdapter');
            invalidatePrefixCache(guildId);
        } catch(e) {}
    } catch (err) {
        console.error('setMainPrefix error:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function addSecondaryPrefix(guildId, newPrefix) {
    await ensurePrefixTable();
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT COUNT(*) as count FROM guild_prefixes WHERE guild_id = ?', [guildId]);
        if (rows[0].count >= 10) return { success: false, message: 'Maksimum 10 prefix sınırına ulaşıldı.' };

        await conn.query(`
            INSERT INTO guild_prefixes (guild_id, prefix, is_main)
            VALUES (?, ?, FALSE)
            ON DUPLICATE KEY UPDATE is_main = is_main
        `, [guildId, newPrefix]);
        try {
            const { invalidatePrefixCache } = require('./messageCommandAdapter');
            invalidatePrefixCache(guildId);
        } catch(e) {}
        return { success: true };
    } catch (err) {
        console.error('addSecondaryPrefix error:', err);
        return { success: false, message: err.message };
    } finally {
        if (conn) conn.release();
    }
}

async function removeGuildPrefix(guildId, prefixToRemove) {
    await ensurePrefixTable();
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM guild_prefixes WHERE guild_id = ? AND prefix = ?', [guildId, prefixToRemove]);
        // If no main left, set first remaining as main
        const remaining = await conn.query('SELECT prefix, is_main FROM guild_prefixes WHERE guild_id = ?', [guildId]);
        if (remaining.length > 0 && !remaining.some(r => r.is_main)) {
            await conn.query('UPDATE guild_prefixes SET is_main = TRUE WHERE guild_id = ? AND prefix = ?', [guildId, remaining[0].prefix]);
        }
        try {
            const { invalidatePrefixCache } = require('./messageCommandAdapter');
            invalidatePrefixCache(guildId);
        } catch(e) {}
    } catch (err) {
        console.error('removeGuildPrefix error:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function resetGuildPrefixes(guildId) {
    await ensurePrefixTable();
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM guild_prefixes WHERE guild_id = ?', [guildId]);
        await conn.query('INSERT INTO guild_prefixes (guild_id, prefix, is_main) VALUES (?, "/", TRUE)', [guildId]);
        try {
            const { invalidatePrefixCache } = require('./messageCommandAdapter');
            invalidatePrefixCache(guildId);
        } catch(e) {}
    } catch (err) {
        console.error('resetGuildPrefixes error:', err);
    } finally {
        if (conn) conn.release();
    }
}

function renderPrefixPanel(guild, prefixList) {
    const eSettings = getMonoEmoji('settings') || getMonoEmoji('gear');
    const eChannel = getMonoEmoji('channel') || getMonoEmoji('message');
    const eStatus = getMonoEmoji('status') || getMonoEmoji('settings');
    const eLink = getMonoEmoji('link') || getMonoEmoji('file');

    let mainPrefix = prefixList.find(p => p.is_main)?.prefix || prefixList[0]?.prefix || '/';
    const usedCount = prefixList.length;
    const activePrefixesStr = prefixList.map(p => `\`${p.prefix}\``).join(' ');

    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eSettings} Çoklu Prefix Yönetimi\nSunucunun ana prefixini seçebilir ve aynı anda çalışan ek prefixler ekleyebilirsin.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Status Info
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `» ${eChannel} **Ana Prefix** › \`${mainPrefix}\`\n` +
            `» ${eStatus} **Kullanılan Alan** › \`${usedCount}/10\`\n` +
            `» ${eLink} **Aktif Prefixler** › ${activePrefixesStr}`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Helper Note
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`Tüm prefixler aynı komutları çalıştırır. Yardım ekranlarında ana prefix kullanılır: \`${mainPrefix}\``)
    );

    // 4. Buttons (2 Action Rows)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prefix_btn_main')
            .setLabel('Ana Prefix')
            .setEmoji(MONO_EMOJIS.signature || MONO_EMOJIS.settings)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('prefix_btn_add')
            .setLabel('Prefix Ekle')
            .setEmoji(MONO_EMOJIS.add || MONO_EMOJIS.file)
            .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prefix_btn_remove')
            .setLabel('Prefix Kaldır')
            .setEmoji(MONO_EMOJIS.delete || MONO_EMOJIS.cross)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(usedCount <= 1),
        new ButtonBuilder()
            .setCustomId('prefix_btn_reset')
            .setLabel('Sıfırla')
            .setEmoji(MONO_EMOJIS.refresh || MONO_EMOJIS.status)
            .setStyle(ButtonStyle.Danger)
    );

    container.addActionRowComponents(row1, row2);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

function renderPrefixRemoveView(guild, prefixList) {
    const eDelete = getMonoEmoji('delete') || getMonoEmoji('cross');

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eDelete} Prefix Kaldırma\nKaldırmak istediğiniz prefixi aşağıdaki listeden seçin.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const options = prefixList.map(p => ({
        label: p.prefix + (p.is_main ? ' (Ana Prefix)' : ''),
        value: p.prefix,
        description: p.is_main ? 'Ana prefix kaldırılırsa listedeki ilk prefix ana yapılır' : 'Ek prefix'
    }));

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('prefix_sel_remove')
            .setPlaceholder('Kaldırılacak prefixi seçin...')
            .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prefix_btn_cancel')
            .setLabel('Vazgeç / Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || MONO_EMOJIS.status)
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(menuRow, btnRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

async function handlePrefixButtons(interaction) {
    const customId = interaction.customId;
    const guild = interaction.guild;

    if (customId !== 'prefix_btn_main' && customId !== 'prefix_btn_add') {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (e) {
            return;
        }
    }

    // 1. Ana Prefix Butonu -> Modal
    if (customId === 'prefix_btn_main') {
        const prefixes = await getGuildPrefixes(guild.id);
        const currentMain = prefixes.find(p => p.is_main)?.prefix || '/';

        const modal = new ModalBuilder()
            .setCustomId('modal_prefix_main')
            .setTitle('Ana Prefix Değiştir');

        const input = new TextInputBuilder()
            .setCustomId('prefix_input_val')
            .setLabel('Yeni Ana Prefix (Maksimum 5 karakter)')
            .setPlaceholder('Örn: / veya ! veya .')
            .setStyle(TextInputStyle.Short)
            .setValue(currentMain)
            .setMaxLength(5)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // 2. Prefix Ekle Butonu -> Modal
    if (customId === 'prefix_btn_add') {
        const modal = new ModalBuilder()
            .setCustomId('modal_prefix_add')
            .setTitle('Yeni Prefix Ekle');

        const input = new TextInputBuilder()
            .setCustomId('prefix_input_val')
            .setLabel('Eklenecek Prefix (Maksimum 5 karakter)')
            .setPlaceholder('Örn: ! veya . veya ?')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(5)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // 3. Prefix Kaldır Butonu -> Seçim Menüsü
    if (customId === 'prefix_btn_remove') {
        await interaction.deferUpdate();
        const prefixes = await getGuildPrefixes(guild.id);
        const removePayload = renderPrefixRemoveView(guild, prefixes);
        return await interaction.editReply(removePayload);
    }

    // 4. Vazgeç / Geri Butonu
    if (customId === 'prefix_btn_cancel') {
        await interaction.deferUpdate();
        const prefixes = await getGuildPrefixes(guild.id);
        const mainPayload = renderPrefixPanel(guild, prefixes);
        return await interaction.editReply(mainPayload);
    }

    // 5. Sıfırla Butonu
    if (customId === 'prefix_btn_reset') {
        await interaction.deferUpdate();
        await resetGuildPrefixes(guild.id);
        const prefixes = await getGuildPrefixes(guild.id);
        const mainPayload = renderPrefixPanel(guild, prefixes);
        await interaction.editReply(mainPayload);
        await interaction.followUp({
            content: 'Sunucu prefixleri sıfırlandı. Varsayılan ana prefix: `/`',
            flags: MessageFlags.Ephemeral
        });
        return;
    }
}

async function handlePrefixModals(interaction) {
    const customId = interaction.customId;
    const guild = interaction.guild;

    await interaction.deferUpdate();

    const val = interaction.fields.getTextInputValue('prefix_input_val')?.trim();
    if (!val) return;

    if (customId === 'modal_prefix_main') {
        await setMainPrefix(guild.id, val);
    } else if (customId === 'modal_prefix_add') {
        await addSecondaryPrefix(guild.id, val);
    }

    const prefixes = await getGuildPrefixes(guild.id);
    const mainPayload = renderPrefixPanel(guild, prefixes);
    await interaction.editReply(mainPayload);
}

async function handlePrefixSelect(interaction) {
    const customId = interaction.customId;
    const guild = interaction.guild;

    await interaction.deferUpdate();

    if (customId === 'prefix_sel_remove') {
        const selected = interaction.values[0];
        if (selected) {
            await removeGuildPrefix(guild.id, selected);
        }
        const prefixes = await getGuildPrefixes(guild.id);
        const mainPayload = renderPrefixPanel(guild, prefixes);
        return await interaction.editReply(mainPayload);
    }
}

module.exports = {
    getGuildPrefixes,
    setMainPrefix,
    addSecondaryPrefix,
    removeGuildPrefix,
    resetGuildPrefixes,
    renderPrefixPanel,
    handlePrefixButtons,
    handlePrefixModals,
    handlePrefixSelect
};
