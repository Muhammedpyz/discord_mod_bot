const { Routes, MessageFlags } = require('discord.js');
const { pool, getVanityConfig, setVanityConfig } = require('../db');
const { MONO_EMOJIS } = require('./uiBuilder');

// ============================================================
// VANITY PANELİ
// ============================================================
async function buildVanityPanel(guild) {
    const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
    const cfg = await getVanityConfig(guild.id).catch(() => null) || {};

    const isEnabled = Boolean(cfg.is_enabled);
    const role = cfg.role_id ? guild.roles.cache.get(cfg.role_id) : null;
    const configReady = Boolean(cfg.vanity_string) && Boolean(role);

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> Vanity`)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            'Özel durumuna sunucu yazını ekleyen üyelere otomatik rol verir.\n' +
            'Üye yazıyı kaldırınca rol otomatik alınır.'
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const statusText =
        `- **Sistem** › ${isEnabled ? `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> \`Aktif\`` : `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> \`Kapalı\``}\n` +
        `- **Aranan yazı** › ${cfg.vanity_string ? `\`${cfg.vanity_string}\`` : '`ayarlanmadı`'}\n` +
        `- **Verilecek rol** › ${role ? `<@&${role.id}>` : '`ayarlanmadı`'}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sec_va_text_btn')
            .setLabel('Yazı Ayarla')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.pen_tool || '1537767814214189086'),
        new ButtonBuilder()
            .setCustomId('sec_va_role_btn')
            .setLabel('Rol Ayarla')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.medal || '1537767798472704032'),
        new ButtonBuilder()
            .setCustomId('sec_va_toggle_btn')
            .setLabel(isEnabled ? 'Kapat' : 'Aç')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!configReady)
            .setEmoji(MONO_EMOJIS.power_off || '1537770135467860099'),
        new ButtonBuilder()
            .setCustomId('sec_va_reset_btn')
            .setLabel('Sıfırla')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.rotate_ccw || '1537768179000938526')
    );

    container.addActionRowComponents(row1);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

// ============================================================
// MODAL YARDIMCILARI
// ============================================================
function extractModalValues(interaction) {
    const values = {};
    const rawComponents = (interaction.data && interaction.data.components) || interaction.components || [];

    function traverse(comps) {
        if (!comps || !Array.isArray(comps)) return;
        for (const c of comps) {
            if (c.component) traverse([c.component]);
            if (c.components) traverse(c.components);
            const id = c.customId || c.custom_id;
            if (id) {
                if (c.values !== undefined) values[id] = c.values;
                else if (c.value !== undefined) values[id] = c.value;
            }
        }
    }
    traverse(rawComponents);
    if (interaction.fields && interaction.fields.fields) {
        for (const [key, field] of interaction.fields.fields.entries()) {
            if (values[key] === undefined) {
                values[key] = field.value !== undefined ? field.value : field.values;
            }
        }
    }
    return values;
}

async function showRawModal(interaction, client, modalData) {
    return await client.rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
        body: { type: 9, data: modalData }
    });
}

// ============================================================
// ANA HANDLER
// ============================================================
async function handleSecurityPanelInteraction(interaction, client) {
    if (!interaction.isButton() && !interaction.isModalSubmit() &&
        !interaction.isChannelSelectMenu() && !interaction.isRoleSelectMenu()) return false;
    if (!interaction.customId.startsWith('sec_')) return false;

    const customId = interaction.customId;
    const guildId = interaction.guild.id;

    // ---------- VANITY ----------
    if (customId === 'sec_va_text_btn') {
        const cfg = await getVanityConfig(guildId).catch(() => null) || {};
        const modalData = {
            title: 'Vanity Yazısı',
            custom_id: 'sec_va_text_modal',
            components: [
                {
                    type: 18,
                    label: 'Durumda aranacak yazı',
                    description: 'Üyenin özel durumunda (Custom Status) aranacak metin. Örn: .gg/turklion',
                    required: false,
                    component: {
                        type: 4,
                        custom_id: 'vanity_text_input',
                        style: 1,
                        value: cfg.vanity_string || '',
                        max_length: 60,
                        required: true
                    }
                }
            ]
        };
        try {
            await showRawModal(interaction, client, modalData);
        } catch (e) {
            console.error('Vanity yazı modal hatası:', e);
        }
        return true;
    }

    if (customId === 'sec_va_text_modal') {
        await interaction.deferUpdate().catch(() => {});
        const values = extractModalValues(interaction);
        const text = (values['vanity_text_input'] || '').toString().trim();
        const cfg = await getVanityConfig(guildId).catch(() => null) || {};
        if (text) {
            await setVanityConfig(guildId, text, cfg.role_id || null, null, Boolean(cfg.is_enabled)).catch(() => {});
        }
        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'sec_va_role_btn') {
        await interaction.deferUpdate().catch(() => {});
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, RoleSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
        const select = new RoleSelectMenuBuilder()
            .setCustomId('sec_va_role_select')
            .setPlaceholder('Verilecek rolü seç')
            .setMinValues(1).setMaxValues(1);
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### Rol Ayarla'));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Yazıyı durumuna ekleyen üyelere verilecek rolü seç.'));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'sec_va_role_select') {
        await interaction.deferUpdate().catch(() => {});
        const roleId = interaction.values?.[0];
        const role = interaction.guild.roles.cache.get(roleId);
        if (role && role.position >= interaction.guild.members.me.roles.highest.position) {
            const { ContainerBuilder, TextDisplayBuilder } = require('discord.js');
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Yetki Yetersiz`));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@&${roleId}> rolü benim en yüksek rolümden üstte! Rolü verebilmem için rol sırasını bot rolümün altına çekmelisin.`));
            await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
            return true;
        }
        if (roleId) {
            const cfg = await getVanityConfig(guildId).catch(() => null) || {};
            await setVanityConfig(guildId, cfg.vanity_string || null, roleId, null, Boolean(cfg.is_enabled)).catch(() => {});
        }
        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'sec_va_toggle_btn') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = await getVanityConfig(guildId).catch(() => null) || {};
        await setVanityConfig(guildId, cfg.vanity_string || null, cfg.role_id || null, null, !Boolean(cfg.is_enabled)).catch(() => {});
        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'sec_va_reset_btn') {
        await interaction.deferUpdate().catch(() => {});
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Vanity Sıfırla`));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Vanity yazısı, rolü ve tüm ayarlar silinecek. Bu işlem geri alınamaz.'));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sec_va_reset_confirm').setLabel('Evet, Sıfırla').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.check || '1530917534885478600'),
            new ButtonBuilder().setCustomId('sec_va_reset_cancel').setLabel('İptal').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross || '1530917536806469783')
        );
        container.addActionRowComponents(row);
        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (customId === 'sec_va_reset_confirm') {
        await interaction.deferUpdate().catch(() => {});
        await pool.query('DELETE FROM guild_vanity_config WHERE guild_id = ?', [guildId]).catch(() => {});
        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (customId === 'sec_va_reset_cancel') {
        await interaction.deferUpdate().catch(() => {});
        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    return false;
}

module.exports = { handleSecurityPanelInteraction, buildVanityPanel };