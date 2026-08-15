const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
    ChannelType,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const { getCompleteGuildLogState } = require('../db');
const { LOG_CATEGORIES, ALL_EVENTS, TOTAL_EVENTS_COUNT, TOTAL_CATEGORIES_COUNT } = require('./logCatalog');
const { MONO_EMOJIS } = require('./uiBuilder');

/**
 * 1. Main Dashboard (/log)
 */
async function buildLogMainPanel(guildId, guild = null) {
    const state = await getCompleteGuildLogState(guildId);
    const container = new ContainerBuilder();

    // 1. Header
    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.file_text || '1537767812544729179'}> Log Sistemi\n\n` +
        `Sunucunda olan biten her şeyi kayıt altına al.\n` +
        `Her kategoriyi **ayrı kanala** yönlendirebilir, tek tek olayları **kapatabilir**, belirli kanal/rol/kişileri **yok saydırabilirsin**.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Status calculations
    let connectedCategoriesCount = 0;
    for (const [catId, chId] of Object.entries(state.channels)) {
        if (chId && (!guild || guild.channels.cache.has(chId))) {
            connectedCategoriesCount++;
        }
    }

    let activeEventsCount = 0;
    for (const ev of ALL_EVENTS) {
        if (state.events[ev.id] !== false) {
            activeEventsCount++;
        }
    }

    const ignoredChannelsCount = state.ignored.channels.size;
    const ignoredRolesCount = state.ignored.roles.size;
    const ignoredUsersCount = state.ignored.users.size;
    const botIgnoreText = state.ignoreBots ? 'Aktif' : 'Pasif';

    let warningText = '';
    if (connectedCategoriesCount === 0) {
        warningText = `### <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Henüz hiçbir kanal atanmamış.\n` +
                      `**Hızlı Kurulum** ile tek kanala hepsini bağlayabilirsin.\n\n`;
    }

    const statsText =
        `${warningText}` +
        `**Bağlantı Durumu:** \`${connectedCategoriesCount}/${TOTAL_CATEGORIES_COUNT}\` kategori bağlı\n` +
        `**Olay Durumu:** \`${activeEventsCount}/${TOTAL_EVENTS_COUNT}\` olay açık\n` +
        `**Yok Sayılanlar:** \`${ignoredChannelsCount}\` kanal · \`${ignoredRolesCount}\` rol · \`${ignoredUsersCount}\` kişi (Bot Koruması: \`${botIgnoreText}\`)`;

    const statusDisplay = new TextDisplayBuilder().setContent(statsText);
    container.addTextDisplayComponents(statusDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Interactive Buttons matching Screenshots
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_channels')
            .setLabel('Kanallar')
            .setEmoji(MONO_EMOJIS.sliders || '1537768211930419262')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('log_btn_events')
            .setLabel('Olaylar')
            .setEmoji(MONO_EMOJIS.settings || '1530917511711948903')
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_ignored')
            .setLabel('Yok Sayılanlar')
            .setEmoji(MONO_EMOJIS.cross || '1530917536806469783')
            .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_quick_setup')
            .setLabel('Hızlı Kurulum')
            .setEmoji(MONO_EMOJIS.discord || '1530917539859660952')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('log_btn_diagnostic')
            .setLabel('Tanılama')
            .setEmoji(MONO_EMOJIS.search || '1530917510189285528')
            .setStyle(ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_reset')
            .setLabel('Sıfırla')
            .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
            .setStyle(ButtonStyle.Danger)
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);
    container.addActionRowComponents(row4);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 2. Categories Channels Panel
 */
async function buildLogChannelsPanel(guildId, guild = null) {
    const state = await getCompleteGuildLogState(guildId);
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.sliders || '1537768211930419262'}> Kategori Kanalları\n\n` +
        `Her kategorinin logları hangi kanala düşsün?\n` +
        `Menüden kategori seç, sonra kanalı belirle. Bir kategoriyi boş bırakırsan o olaylar loglanmaz.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let listLines = [];
    const selectOptions = [];

    for (const [catId, cat] of Object.entries(LOG_CATEGORIES)) {
        const assignedChId = state.channels[catId];
        let statusStr = '*atanmamış*';
        if (assignedChId) {
            if (guild && !guild.channels.cache.has(assignedChId)) {
                statusStr = '*silinmiş kanal*';
            } else {
                statusStr = `<#${assignedChId}>`;
            }
        }

        const monoKey = cat.emojiKey && MONO_EMOJIS[cat.emojiKey] ? MONO_EMOJIS[cat.emojiKey] : cat.emojiFallback;
        listLines.push(`<:mono:${monoKey}> **${cat.name}** → ${statusStr}`);

        selectOptions.push({
            label: cat.name,
            value: cat.id,
            description: cat.description.slice(0, 50),
            emoji: { id: monoKey }
        });
    }

    const listDisplay = new TextDisplayBuilder().setContent(listLines.join('\n'));
    container.addTextDisplayComponents(listDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('log_select_category_for_channel')
            .setPlaceholder('Ayarlanacak kategoriyi seç...')
            .addOptions(selectOptions.slice(0, 25))
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_back_main')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(selectRow);
    container.addActionRowComponents(backRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 2.1. Assign Channel to a Category Panel
 */
async function buildLogAssignChannelPanel(guildId, categoryId, guild = null) {
    const cat = LOG_CATEGORIES[categoryId];
    if (!cat) return buildLogChannelsPanel(guildId, guild);

    const state = await getCompleteGuildLogState(guildId);
    const assignedChId = state.channels[categoryId];
    const assignedStr = assignedChId ? `<#${assignedChId}>` : '`atanmamış`';

    const monoKey = cat.emojiKey && MONO_EMOJIS[cat.emojiKey] ? MONO_EMOJIS[cat.emojiKey] : cat.emojiFallback;
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${monoKey}> ${cat.name} Log Kanalı\n\n` +
        `**Mevcut Kanal:** ${assignedStr}\n` +
        `**Açıklama:** ${cat.description}\n\n` +
        `Bu kategorideki olayların gönderileceği metin kanalını aşağıdan seçin.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const channelSelectRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId(`log_assign_ch_${categoryId}`)
            .setPlaceholder(`${cat.name} için kanal seçin...`)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`log_btn_remove_ch_${categoryId}`)
            .setLabel('Kanalı Kaldır')
            .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!assignedChId),
        new ButtonBuilder()
            .setCustomId('log_btn_channels')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(channelSelectRow);
    container.addActionRowComponents(actionRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 3. Events Overview Panel
 */
async function buildLogEventsPanel(guildId) {
    const state = await getCompleteGuildLogState(guildId);
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.settings || '1530917511711948903'}> Olay Kontrolü\n\n` +
        `Hangi olayların loglanacağını tek tek seç. İşaretli olanlar loglanır.\n` +
        `Gürültü yapan olayları (ses giriş/çıkış gibi) buradan kapatabilirsin.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let listLines = [];
    const selectOptions = [];

    for (const [catId, cat] of Object.entries(LOG_CATEGORIES)) {
        const totalCatEvents = cat.events.length;
        let activeCatEvents = 0;
        for (const ev of cat.events) {
            if (state.events[ev.id] !== false) activeCatEvents++;
        }

        const monoKey = cat.emojiKey && MONO_EMOJIS[cat.emojiKey] ? MONO_EMOJIS[cat.emojiKey] : cat.emojiFallback;
        const statusBadge = activeCatEvents === totalCatEvents 
            ? `\`${activeCatEvents}/${totalCatEvents}\`` 
            : activeCatEvents === 0 
                ? `\`kapalı\`` 
                : `\`${activeCatEvents}/${totalCatEvents}\``;

        listLines.push(`<:mono:${monoKey}> **${cat.name}** › ${statusBadge}`);

        selectOptions.push({
            label: `${cat.name} (${activeCatEvents}/${totalCatEvents})`,
            value: cat.id,
            description: cat.description.slice(0, 50),
            emoji: { id: monoKey }
        });
    }

    const listDisplay = new TextDisplayBuilder().setContent(listLines.join('\n'));
    container.addTextDisplayComponents(listDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('log_select_category_for_events')
            .setPlaceholder('Düzenlenecek kategoriyi seç...')
            .addOptions(selectOptions.slice(0, 25))
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_back_main')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(selectRow);
    container.addActionRowComponents(backRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 3.1. Specific Category Events Toggle Panel
 */
async function buildLogCategoryEventsPanel(guildId, categoryId) {
    const cat = LOG_CATEGORIES[categoryId];
    if (!cat) return buildLogEventsPanel(guildId);

    const state = await getCompleteGuildLogState(guildId);
    const monoKey = cat.emojiKey && MONO_EMOJIS[cat.emojiKey] ? MONO_EMOJIS[cat.emojiKey] : cat.emojiFallback;
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${monoKey}> ${cat.name} Olayları\n\n` +
        `Aşağıdaki menüyü kullanarak aktif olmasını istediğin olayları seç.\n` +
        `*Seçilen olaylar loglanır, seçilmeyenler devre dışı kalır.*`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let listLines = [];
    const selectOptions = [];

    for (const ev of cat.events) {
        const isEnabled = state.events[ev.id] !== false;
        const icon = isEnabled ? `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}>` : `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}>`;
        listLines.push(`${icon} **${ev.name}** — ${ev.desc}`);

        selectOptions.push({
            label: ev.name,
            value: ev.id,
            description: ev.desc.slice(0, 50),
            default: isEnabled
        });
    }

    const listDisplay = new TextDisplayBuilder().setContent(listLines.join('\n'));
    container.addTextDisplayComponents(listDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`log_toggle_events_${categoryId}`)
            .setPlaceholder('Aktif olayları seçin...')
            .setMinValues(0)
            .setMaxValues(cat.events.length)
            .addOptions(selectOptions)
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`log_btn_enable_all_${categoryId}`)
            .setLabel('Tümünü Aç')
            .setEmoji(MONO_EMOJIS.check || '1530917534885478600')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`log_btn_disable_all_${categoryId}`)
            .setLabel('Tümünü Kapat')
            .setEmoji(MONO_EMOJIS.cross || '1530917536806469783')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('log_btn_events')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(selectRow);
    container.addActionRowComponents(actionRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 4. Ignored Entities Panel
 */
async function buildLogIgnoredPanel(guildId, guild = null) {
    const state = await getCompleteGuildLogState(guildId);
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Yok Sayma Listeleri\n\n` +
        `Bu listelere eklenen kanal, rol veya kişilerin hareketleri **hiçbir loga kaydedilmez**.\n` +
        `Komut kanalları veya yetkili odalarını ekleyerek log kirliliğini önleyebilirsiniz.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const chList = Array.from(state.ignored.channels).map(id => `<#${id}>`).join(' ') || '*Yok*';
    const roleList = Array.from(state.ignored.roles).map(id => `<@&${id}>`).join(' ') || '*Yok*';
    const userList = Array.from(state.ignored.users).map(id => `<@${id}>`).join(' ') || '*Yok*';
    const botStatus = state.ignoreBots ? 'AÇIK (Botlar Loglanmaz)' : 'KAPALI (Botlar Loglanır)';

    const listText =
        `**Yok Sayılan Kanallar:** ${chList}\n` +
        `**Yok Sayılan Roller:** ${roleList}\n` +
        `**Yok Sayılan Kişiler:** ${userList}\n` +
        `**Bot Koruması:** \`${botStatus}\``;

    const listDisplay = new TextDisplayBuilder().setContent(listText);
    container.addTextDisplayComponents(listDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const chSelectRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('log_select_ignored_channels')
            .setPlaceholder('Yok sayılacak kanalları seç/kaldır...')
            .setMinValues(0)
            .setMaxValues(10)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
    );

    const roleSelectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('log_select_ignored_roles')
            .setPlaceholder('Yok sayılacak rolleri seç/kaldır...')
            .setMinValues(0)
            .setMaxValues(10)
    );

    const userSelectRow = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId('log_select_ignored_users')
            .setPlaceholder('Yok sayılacak kişileri seç/kaldır...')
            .setMinValues(0)
            .setMaxValues(10)
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_toggle_ignore_bots')
            .setLabel(state.ignoreBots ? 'Botları Logla' : 'Botları Yok Say')
            .setEmoji(MONO_EMOJIS.shield || '1530917506867400775')
            .setStyle(state.ignoreBots ? ButtonStyle.Secondary : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('log_btn_back_main')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(chSelectRow);
    container.addActionRowComponents(roleSelectRow);
    container.addActionRowComponents(userSelectRow);
    container.addActionRowComponents(actionRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 5. Diagnostic Panel
 */
async function buildLogDiagnosticPanel(guildId, guild = null) {
    const state = await getCompleteGuildLogState(guildId);
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.search || '1530917510189285528'}> Log Tanılama\n\n` +
        `Her kategori için kanal, yetki ve olay durumunu kontrol ettim.\n` +
        `Log gelmiyorsa eksik veya hatalı durumlar aşağıda listelenmiştir.`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let reportLines = [];
    const botMember = guild?.members?.me;

    for (const [catId, cat] of Object.entries(LOG_CATEGORIES)) {
        const assignedChId = state.channels[catId];
        const totalCatEvents = cat.events.length;
        let activeCatEvents = 0;
        for (const ev of cat.events) {
            if (state.events[ev.id] !== false) activeCatEvents++;
        }

        const monoKey = cat.emojiKey && MONO_EMOJIS[cat.emojiKey] ? MONO_EMOJIS[cat.emojiKey] : cat.emojiFallback;

        if (!assignedChId) {
            reportLines.push(
                `<:mono:${monoKey}> **${cat.name}** → *atanmamış*\n` +
                `└ <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Kanal atanmamış — \`/log → Kanallar\` · \`${activeCatEvents}/${totalCatEvents}\``
            );
        } else {
            const channel = guild?.channels?.cache?.get(assignedChId);
            if (!channel) {
                reportLines.push(
                    `<:mono:${monoKey}> **${cat.name}** → *silinmiş kanal*\n` +
                    `└ <:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Kanal sunucuda bulunamadı! · \`${activeCatEvents}/${totalCatEvents}\``
                );
            } else if (botMember) {
                const perms = channel.permissionsFor(botMember);
                const hasView = perms?.has(PermissionFlagsBits.ViewChannel);
                const hasSend = perms?.has(PermissionFlagsBits.SendMessages);
                const hasEmbed = perms?.has(PermissionFlagsBits.EmbedLinks);

                if (!hasView || !hasSend || !hasEmbed) {
                    let missing = [];
                    if (!hasView) missing.push('Kanalı Görüntüle');
                    if (!hasSend) missing.push('Mesaj Gönder');
                    if (!hasEmbed) missing.push('Bağlantı Yerleştir');

                    reportLines.push(
                        `<:mono:${monoKey}> **${cat.name}** → <#${assignedChId}>\n` +
                        `└ <:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Eksik Yetki: ${missing.join(', ')} · \`${activeCatEvents}/${totalCatEvents}\``
                    );
                } else {
                    reportLines.push(
                        `<:mono:${monoKey}> **${cat.name}** → <#${assignedChId}>\n` +
                        `└ <:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Yetkiler Tam · \`${activeCatEvents}/${totalCatEvents}\``
                    );
                }
            } else {
                reportLines.push(
                    `<:mono:${monoKey}> **${cat.name}** → <#${assignedChId}> · \`${activeCatEvents}/${totalCatEvents}\``
                );
            }
        }
    }

    const reportDisplay = new TextDisplayBuilder().setContent(reportLines.join('\n\n'));
    container.addTextDisplayComponents(reportDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_back_main')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(backRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 6. Quick Setup Panel
 */
function buildLogQuickSetupPanel() {
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.discord || '1530917539859660952'}> Hızlı Log Kurulumu\n\n` +
        `Tüm 14 kategoriyi tek bir kanala bağlamak için aşağıdan bir metin kanalı seçin.\n` +
        `*Daha sonra istediğiniz kategoriyi özel kanallara ayırabilirsiniz.*`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const channelSelectRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('log_select_quick_setup_channel')
            .setPlaceholder('Tüm logların gideceği kanalı seçin...')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_back_main')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(channelSelectRow);
    container.addActionRowComponents(backRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

/**
 * 7. Reset Confirmation Panel
 */
function buildLogResetConfirmPanel() {
    const container = new ContainerBuilder();

    const headerDisplay = new TextDisplayBuilder().setContent(
        `# <:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> Log Ayarlarını Sıfırla\n\n` +
        `Sunucunun tüm log kanalları, kapatılan olayları ve yok sayma listeleri **tamamen sıfırlanacaktır**.\n\n` +
        `Bu işlemi onaylıyor musunuz?`
    );
    container.addTextDisplayComponents(headerDisplay);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_btn_reset_confirm')
            .setLabel('Evet, Sıfırla')
            .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('log_btn_back_main')
            .setLabel('İptal')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(actionRow);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

module.exports = {
    buildLogMainPanel,
    buildLogChannelsPanel,
    buildLogAssignChannelPanel,
    buildLogEventsPanel,
    buildLogCategoryEventsPanel,
    buildLogIgnoredPanel,
    buildLogDiagnosticPanel,
    buildLogQuickSetupPanel,
    buildLogResetConfirmPanel
};
