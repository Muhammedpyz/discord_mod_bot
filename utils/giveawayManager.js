const { 
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, ModalBuilder,
    TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('./uiBuilder');
const { logGiveaway } = require('./giveawayLogger');

// Geçici çekiliş taslakları hafızası
const activeDrafts = new Map();

function parseDuration(durationStr) {
    if (!durationStr) return 0;
    const str = durationStr.toLowerCase().trim();
    let durationMs = 0;
    const regex = /(\d+)\s*(dakika|dak|dk|saat|sa|gun|gün|saniye|sn|hafta|min|sec|d|g|s|h|m|w)/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const val = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === 'd' || unit === 'g' || unit.startsWith('g') || unit.startsWith('gün') || unit.startsWith('gun')) {
            durationMs += val * 24 * 60 * 60 * 1000;
        } else if (unit === 'sa' || unit.startsWith('saat') || unit === 'h' || unit === 's') {
            durationMs += val * 60 * 60 * 1000;
        } else if (unit === 'dk' || unit.startsWith('dak') || unit === 'm' || unit === 'min') {
            durationMs += val * 60 * 1000;
        } else if (unit === 'sn' || unit.startsWith('san') || unit === 'sec') {
            durationMs += val * 1000;
        } else if (unit === 'w' || unit.startsWith('haf')) {
            durationMs += val * 7 * 24 * 60 * 60 * 1000;
        }
    }
    return durationMs;
}

function buildGiveawayPayload(gw, isEnded = false, winners = [], showPartsBtn = true) {
    const totalParts = gw.participants ? gw.participants.length : 0;
    const endsEpoch = Math.floor(Number(gw.ends_at) / 1000);

    const mainContainer = new ContainerBuilder();

    if (!isEnded && gw.status === 'active') {
        const descText = `<:mono:${MONO_EMOJIS.gift || '1537767784694423602'}> **${gw.prize}**\n\n` +
            `${gw.description ? `${gw.description}\n\n` : ''}` +
            `<:mono:${MONO_EMOJIS.hash || '1537770187129094267'}> **Kanal ›** <#${gw.channel_id}>\n` +
            `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazanan ›** ${gw.winner_count} kişi\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Katılım ›** ${totalParts} kişi\n` +
            `<:mono:${MONO_EMOJIS.clock || '1537769987647733831'}> **Bitiş ›** <t:${endsEpoch}:R> (<t:${endsEpoch}:F>)\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
            `${gw.required_role_id ? `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Şart Rol ›** <@&${gw.required_role_id}>\n` : ''}`;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_join:${gw.message_id}`).setLabel(`Katıl`).setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.gift || '1537767784694423602')
        );
        if (showPartsBtn) {
            row.addComponents(
                new ButtonBuilder().setCustomId(`gw_parts:${gw.message_id}`).setLabel(`Katılanlar (${totalParts})`).setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user || '1537768132062486558')
            );
        }
        
        if (gw.image_url && typeof gw.image_url === 'string' && gw.image_url.startsWith('http')) {
            const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
            const mediaGallery = new MediaGalleryBuilder();
            mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: gw.image_url.trim() } }));
            mainContainer.addMediaGalleryComponents(mediaGallery);
        }

        mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        mainContainer.addActionRowComponents(row);

    } else {
        const winnerText = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Kazanan çıkmadı';
        
        const descText = `<:mono:${MONO_EMOJIS.gift || '1537767784694423602'}> **${gw.prize}**\n\n🎉 **ÇEKİLİŞ SONA ERDİ**\n\n${gw.description ? `${gw.description}\n\n` : ''}` +
            `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazananlar ›** ${winnerText}\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Toplam Katılım ›** ${totalParts} kişi\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
            `<:mono:${MONO_EMOJIS.clock || '1537769987647733831'}> **Bitiş Zamanı ›** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `*Tebrikler! Kazananlar ödülleri için sunucu yetkilileriyle iletişime geçebilir.*`;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [mainContainer]
    };
}

function buildManageGiveawayPayload(gw) {
    const totalParts = gw.participants ? gw.participants.length : 0;
    const endsEpoch = Math.floor(Number(gw.ends_at) / 1000);

    const container = new ContainerBuilder();
    
    const descText = `<:mono:${MONO_EMOJIS.settings || '1530917467650523176'}> **Çekiliş Yönetim Paneli**\n\n**${gw.prize}**\n\n` +
        `<:mono:${MONO_EMOJIS.hash || '1537770187129094267'}> **Kanal ›** <#${gw.channel_id}>\n` +
        `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazanan Sayısı ›** ${gw.winner_count} kişi\n` +
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Katılımcı ›** ${totalParts} kişi\n` +
        `<:mono:${MONO_EMOJIS.clock || '1537769987647733831'}> **Bitiş ›** <t:${endsEpoch}:F>\n` +
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
        `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> **Durum ›** ${gw.status === 'active' ? '🟢 Devam Ediyor' : '🔴 Sona Erdi'}\n\n` +
        `${gw.required_role_id ? `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Katılım Koşulu:** <@&${gw.required_role_id}> rolü gerekli.` : 'Katılım koşulu yok — Herkes katılabilir.'}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_forceend:${gw.message_id}`).setLabel('Şimdi Bitir').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.trophy || '1537767825937010708').setDisabled(gw.status !== 'active'),
        new ButtonBuilder().setCustomId(`gw_conditions:${gw.message_id}`).setLabel('Rol Koşulu Ayarla').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.shield || '1530917506867400775'),
        new ButtonBuilder().setCustomId(`gw_reroll_btn:${gw.message_id}`).setLabel('Yeniden Çek (Reroll)').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_cw || '1537768206989791232').setDisabled(gw.status === 'active')
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_parts_toggle:${gw.message_id}`).setLabel(gw.show_parts === false ? 'Katılanlar Butonunu Aç' : 'Katılanlar Butonunu Kapat').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user || '1537768132062486558'),
        new ButtonBuilder().setCustomId(`gw_cancel:${gw.message_id}`).setLabel('Çekilişi İptal Et').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross || '1530917536806469783').setDisabled(gw.status !== 'active')
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_manage:${gw.message_id}`).setLabel('Paneli Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1537768046989410375'),
        new ButtonBuilder().setCustomId('gw_list').setLabel('Çekiliş Listesi').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Ana Menü').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.settings || '1538517265807442090')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildConditionsPanelPayload(messageId) {
    const gw = await db.getGiveaway(messageId);
    if (!gw) return buildMainPanelPayload();

    const container = new ContainerBuilder();
    const descText = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Çekiliş Katılım Koşulu & Rol Yönetimi**\n\n` +
        `**Çekiliş:** \`${gw.prize}\` (<#${gw.channel_id}>)\n` +
        `**Mevcut Şart:** ${gw.required_role_id ? `<@&${gw.required_role_id}> rolüne sahip olanlar katılabilir.` : '`Koşulsuz (Herkes Katılabilir)`'}\n\n` +
        `*Aşağıdaki rol seçim menüsünden çekilişe katılması zorunlu olan rolü seçebilir veya şartı kaldırabilirsiniz:*`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`gw_cond_select_role:${messageId}`)
        .setPlaceholder('Zorunlu Rol Seçin...');

    const row1 = new ActionRowBuilder().addComponents(roleSelect);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_cond_clear:${messageId}`).setLabel('Şartı Kaldır (Herkes Katılsın)').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete || '1530918957349867711'),
        new ButtonBuilder().setCustomId(`gw_manage:${messageId}`).setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildDraftPanelPayload(draft) {
    const endsEpoch = Math.floor((Date.now() + draft.durationMs) / 1000);
    const container = new ContainerBuilder();

    const descText = `<:mono:${MONO_EMOJIS.gift || '1537767784694423602'}> **Yeni Çekiliş Taslağı & Kanal / Rol Seçimi**\n\n` +
        `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> **Ödül ›** \`${draft.prize}\`\n` +
        `<:mono:${MONO_EMOJIS.clock || '1537769987647733831'}> **Süre ›** \`${draft.durationStr}\` (Bitiş: <t:${endsEpoch}:R>)\n` +
        `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazanan Sayısı ›** \`${draft.winnerCount} kişi\`\n` +
        `<:mono:${MONO_EMOJIS.hash || '1537770187129094267'}> **Yayınlanacak Kanal ›** <#${draft.channelId}>\n` +
        `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Zorunlu Rol Şartı ›** ${draft.requiredRoleId ? `<@&${draft.requiredRoleId}>` : '`Yok (Herkes Katılabilir)`'}\n` +
        `<:mono:${MONO_EMOJIS.camera || '1537767876679966751'}> **Görsel / Banner ›** ${draft.imageUrl ? `\`[Görsel Eklendi]\`` : '`Yok`'}\n` +
        `${draft.description ? `\n**Açıklama:**\n> ${draft.description}\n` : ''}\n` +
        `*Aşağıdaki menülerden hedef kanalı ve katılım rolünü seçip **"Çekilişi Başlat"** butonuna basınız:*`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

    if (draft.imageUrl && typeof draft.imageUrl === 'string' && draft.imageUrl.startsWith('http')) {
        const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
        const mediaGallery = new MediaGalleryBuilder();
        mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: draft.imageUrl.trim() } }));
        container.addMediaGalleryComponents(mediaGallery);
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`gw_draft_channel:${draft.id}`)
        .setPlaceholder('Çekilişin Yapılacağı Kanalı Seçin...')
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`gw_draft_role:${draft.id}`)
        .setPlaceholder('Katılım İçin Zorunlu Rol Seçin (İsteğe Bağlı)...');

    const buttonComponents = [
        new ButtonBuilder().setCustomId(`gw_draft_publish:${draft.id}`).setLabel('🚀 Çekilişi Başlat').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gw_draft_clear_role:${draft.id}`).setLabel('Rol Şartını Kaldır').setStyle(ButtonStyle.Secondary)
    ];

    if (draft.imageUrl) {
        buttonComponents.push(
            new ButtonBuilder().setCustomId(`gw_draft_clear_img:${draft.id}`).setLabel('Görseli Kaldır').setStyle(ButtonStyle.Secondary)
        );
    }

    buttonComponents.push(
        new ButtonBuilder().setCustomId('gw_home').setLabel('İptal / Geri').setStyle(ButtonStyle.Danger)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(channelSelect));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(roleSelect));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(buttonComponents));

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildSettingsPanelPayload(guildId) {
    const settings = await db.getGiveawaySettings(guildId);
    let managerRolesArr = [];
    if (settings?.manager_roles) {
        try {
            managerRolesArr = typeof settings.manager_roles === 'string' ? JSON.parse(settings.manager_roles) : settings.manager_roles;
        } catch (e) {
            managerRolesArr = [];
        }
    }

    const container = new ContainerBuilder();
    const descText = `<:mono:${MONO_EMOJIS.settings || '1530917467650523176'}> **Çekiliş Genel Ayarlar Merkezi**\n\n` +
        `<:mono:${MONO_EMOJIS.hash || '1537770187129094267'}> **Log Kanalı ›** ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : '`Kapalı`'}\n` +
        `<:mono:${MONO_EMOJIS.bell || '1537767917666443346'}> **Kazanan Duyuru Rolü (Ping) ›** ${settings.ping_role_id ? `<@&${settings.ping_role_id}>` : '`Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> **Yetkili Rolleri ›** ${managerRolesArr.length > 0 ? managerRolesArr.map(r => `<@&${r}>`).join(', ') : '`Yalnızca Sunucu Yöneticileri`'}\n` +
        `<:mono:${MONO_EMOJIS.mail || '1537768113221799957'}> **Kazanana Otomatik DM Bildirimi ›** \`${settings.dm_winner ? 'AÇIK' : 'KAPALI'}\`\n` +
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Katılanlar Listesi Butonu ›** \`${settings.show_parts !== false ? 'AÇIK' : 'KAPALI'}\`\n\n` +
        `*Aşağıdaki seçicileri kullanarak log kanalını, duyuru rolünü ve yetkili rollerini tek tıkla güncelleyebilirsiniz:*`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('gw_set_channel_log')
        .setPlaceholder('Log Kanalını Seçin...')
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

    const pingRoleSelect = new RoleSelectMenuBuilder()
        .setCustomId('gw_set_role_ping')
        .setPlaceholder('Kazanan Duyuru (Ping) Rolünü Seçin...');

    const managerRoleSelect = new RoleSelectMenuBuilder()
        .setCustomId('gw_set_role_manager')
        .setPlaceholder('Çekiliş Yetkili Rollerini Seçin...')
        .setMinValues(0)
        .setMaxValues(10);

    const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_toggle_dm').setLabel(`DM Bildirimi: ${settings.dm_winner ? 'Kapat' : 'Aç'}`).setStyle(settings.dm_winner ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.mail || '1537768113221799957'),
        new ButtonBuilder().setCustomId('gw_toggle_parts').setLabel(`Katılanlar Butonu: ${settings.show_parts !== false ? 'Kapat' : 'Aç'}`).setStyle(settings.show_parts !== false ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user || '1537768132062486558'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Geri (Ana Menü)').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(channelSelect));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(pingRoleSelect));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(managerRoleSelect));
    container.addActionRowComponents(toggleRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildGiveawayListPayload(guildId) {
    const list = await db.getGuildGiveaways(guildId);
    const activeList = list.filter(g => g.status === 'active');

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.gift || '1537767784694423602'}> **Aktif Çekilişler Listesi**\nYönetmek istediğiniz çekilişi menüden seçin:`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (activeList.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Şu anda devam eden aktif çekiliş bulunmuyor.`));
    } else {
        const listText = activeList.slice(0, 5).map(gw => {
            const endsEpoch = Math.floor(Number(gw.ends_at) / 1000);
            return `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> **${gw.prize}** — <#${gw.channel_id}>\n${gw.participants ? gw.participants.length : 0} katılımcı · ${gw.winner_count} kazanan · <t:${endsEpoch}:R>`;
        }).join('\n\n');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(listText));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const selectMenu = new StringSelectMenuBuilder().setCustomId('gw_manage_select').setPlaceholder('Yönetilecek çekilişi seçin...');
        activeList.slice(0, 25).forEach(gw => {
            selectMenu.addOptions({ label: gw.prize.substring(0, 50), description: `${gw.participants ? gw.participants.length : 0} katılım | ${gw.winner_count} kazanan`, value: gw.message_id });
        });
        container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));
    }

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_list').setLabel('Listeyi Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1537768046989410375'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Ana Menüye Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
    );
    container.addActionRowComponents(btnRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildMainPanelPayload(guildId) {
    const settings = await db.getGiveawaySettings(guildId);
    const activeGWs = await db.getGuildGiveaways(guildId);
    const activeCount = activeGWs.filter(g => g.status === 'active').length;

    let managerRolesArr = [];
    if (settings?.manager_roles) {
        try {
            managerRolesArr = typeof settings.manager_roles === 'string' ? JSON.parse(settings.manager_roles) : settings.manager_roles;
        } catch (e) {
            managerRolesArr = [];
        }
    }

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.gift || '1537767784694423602'}> **TurkLion Çekiliş Yönetim Merkezi**`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `Yeni bir çekiliş başlatabilir, aktif çekilişleri yönetebilir veya sunucu varsayılan ayarlarını düzenleyebilirsiniz.\n\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Yetkili Rolleri ›** ${managerRolesArr.length > 0 ? managerRolesArr.map(r => `<@&${r}>`).join(', ') : '`Yalnızca Yöneticiler`'}\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Log Kanalı ›** ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : '`Kapalı`'}\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Duyuru Rolü ›** ${settings.ping_role_id ? `<@&${settings.ping_role_id}>` : '`Kapalı`'}\n` +
        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Kazanana DM Bildirimi ›** \`${settings.dm_winner ? 'AÇIK' : 'KAPALI'}\`\n` +
        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Katılanlar Listesi Butonu ›** \`${settings.show_parts !== false ? 'AÇIK' : 'KAPALI'}\`\n\n` +
        `*Şu anda sunucuda **${activeCount}** aktif çekiliş devam ediyor.*`
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_new').setLabel('Yeni Çekiliş Başlat').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.plus || '1530917512333787166'),
        new ButtonBuilder().setCustomId('gw_list').setLabel(`Çekilişler (${activeCount})`).setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.search || '1537768093978206240'),
        new ButtonBuilder().setCustomId('gw_settings').setLabel('Genel Ayarlar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.settings || '1530917467650523176'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw || '1537768046989410375')
    );

    container.addActionRowComponents(row1);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function endGiveaway(messageId, client, isReroll = false, customWinnerCount = null) {
    logGiveaway('end_start', { messageId, isReroll, customWinnerCount });
    const gw = await db.getGiveaway(messageId);
    if (!gw) {
        logGiveaway('end_gw_missing', { messageId });
        return { error: 'Çekiliş veritabanında bulunamadı.' };
    }
    if (!isReroll && gw.status === 'ended') {
        logGiveaway('end_already_ended', { messageId });
        return { error: 'Bu çekiliş zaten sonlanmış.' };
    }

    const guild = client.guilds.cache.get(gw.guild_id);
    if (!guild) {
        logGiveaway('end_guild_missing', { messageId, guildId: gw.guild_id });
        return { error: 'Sunucu bulunamadı.' };
    }

    const channel = guild.channels.cache.get(gw.channel_id);
    if (!channel) {
        logGiveaway('end_channel_missing', { messageId, channelId: gw.channel_id });
        return { error: 'Kanal bulunamadı.' };
    }

    let participants = gw.participants || [];

    // Eğer zorunlu rol şartı varsa filtrele
    if (gw.required_role_id) {
        const eligible = [];
        let members;
        try {
            members = await guild.members.fetch({ user: participants });
        } catch(e) {
            members = new Map();
        }
        for (const userId of participants) {
            const member = members.get(userId);
            if (member && member.roles.cache.has(gw.required_role_id)) {
                eligible.push(userId);
            }
        }
        participants = eligible;
    }

    const count = customWinnerCount || gw.winner_count || 1;
    const winners = [];

    // Reroll ise önceki kazananları havuzdan çıkar
    const pool = isReroll ? participants.filter(p => !gw.winners.includes(p)) : [...participants];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (let i = 0; i < Math.min(count, pool.length); i++) {
        winners.push(pool[i]);
    }

    logGiveaway('end_winners_selected', { messageId, totalParticipants: participants.length, winners });

    await db.setGiveawayWinners(messageId, winners);
    const settings = await db.getGiveawaySettings(gw.guild_id);

    try {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
            const payload = buildGiveawayPayload(gw, true, winners, settings ? settings.show_parts : true);
            await msg.edit(payload).catch((e) => logGiveaway('end_msg_edit_failed', { messageId, error: e.message }));
            logGiveaway('end_msg_updated', { messageId });
        }
    } catch (e) {
        logGiveaway('end_msg_update_error', { messageId, error: e.message });
    }

    if (winners.length > 0) {
        const winnerPings = winners.map(w => `<@${w}>`).join(' ');
        const announceContainer = new ContainerBuilder();
        
        const descText = `<:mono:${MONO_EMOJIS.gift || '1537767784694423602'}> **${gw.prize}**\n\n🎉 **ÇEKİLİŞ SONUCU**\n\n${winnerPings} kazandı!\n<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>`;
        announceContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Çekilişe Git')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`)
                .setEmoji(MONO_EMOJIS.external_link || '1537769989669658644')
        );
        announceContainer.addActionRowComponents(row);

        const pingContent = settings?.ping_role_id ? `<@&${settings.ping_role_id}> ${winnerPings}` : winnerPings;

        await channel.send({ 
            content: pingContent, 
            flags: MessageFlags.IsComponentsV2, 
            components: [announceContainer] 
        }).catch((e) => logGiveaway('end_announce_send_failed', { messageId, error: e.message }));

        if (settings?.dm_winner) {
            for (const wid of winners) {
                try {
                    const wmember = await guild.members.fetch(wid);
                    if (wmember) {
                        const dmMsg = createContainerMessage(
                            'Çekilişi Kazandınız!',
                            `Tebrikler! **${guild.name}** sunucusundaki **${gw.prize}** çekilişini kazandınız.\nÖdülünüzü teslim almak için <@${gw.host_id}> ile iletişime geçebilirsiniz.`,
                            COLORS.SUCCESS || '#57F287', [], [], false
                        );
                        await wmember.send(dmMsg).catch(() => {});
                    }
                } catch(e){}
            }
        }
    } else {
        const noWinnerMsg = createContainerMessage(
            'Çekiliş Sona Erdi',
            `**${gw.prize}** çekilişine yeterli katılım olmadığı için kazanan belirlenemedi.`,
            COLORS.ERROR || '#ED4245', [], [], false
        );
        await channel.send(noWinnerMsg).catch(() => {});
    }

    logGiveaway('end_complete', { messageId, winnerCount: winners.length });
    return { success: true, winners };
}

let lastPeriodicSync = 0;
function initGiveawayScheduler(client) {
    setInterval(async () => {
        try {
            const activeList = await db.getActiveGiveaways().catch(() => []);
            const now = Date.now();

            for (const gw of activeList) {
                if (now >= Number(gw.ends_at)) {
                    logGiveaway('scheduler_ending', { messageId: gw.message_id, endsAt: gw.ends_at });
                    await endGiveaway(gw.message_id, client).catch((e) => logGiveaway('scheduler_end_error', { messageId: gw.message_id, error: e.message }));
                }
            }

            // Her 60 saniyede bir aktif çekiliş mesajlarını kanallarda otomatik tazele
            if (now - lastPeriodicSync > 60000 && activeList.length > 0) {
                lastPeriodicSync = now;
                for (const gw of activeList) {
                    try {
                        const channel = client.channels.cache.get(gw.channel_id);
                        if (channel) {
                            const msg = await channel.messages.fetch(gw.message_id).catch(() => null);
                            if (msg) {
                                const payload = buildGiveawayPayload(gw, false, [], gw.show_parts);
                                await msg.edit(payload).catch(() => {});
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error('[Giveaway Scheduler Error]:', e);
        }
    }, 10000);
}

async function hasGiveawayManagerPerms(interaction) {
    if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    const settings = await db.getGiveawaySettings(interaction.guild.id);
    if (settings && settings.manager_roles) {
        let roles = settings.manager_roles;
        if (typeof roles === 'string') try { roles = JSON.parse(roles); } catch(e) { roles = []; }
        if (Array.isArray(roles) && roles.some(r => interaction.member.roles.cache.has(r))) return true;
    }
    return false;
}

async function handleGiveawayButton(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('gw_')) return false;

    // Katılım ve Liste dışındakilerde yetki kontrolü
    if (!customId.startsWith('gw_join') && !customId.startsWith('gw_parts')) {
        const hasPerms = await hasGiveawayManagerPerms(interaction);
        if (!hasPerms) {
            const errPayload = createContainerMessage(
                'Yetki Yetersiz',
                'Bu çekiliş yönetim işlemini gerçekleştirmek için yetkiniz bulunmuyor.',
                COLORS.ERROR || '#ED4245'
            );
            errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            if (interaction.replied || interaction.deferred) await interaction.followUp(errPayload).catch(() => {});
            else await interaction.reply(errPayload).catch(() => {});
            return true;
        }
    }

    // --- 1. MODAL SUBMITLER ---
    if (interaction.isModalSubmit()) {
        if (customId === 'gw_modal_start') {
            await interaction.deferUpdate().catch(() => {});
            const prize = interaction.fields.getTextInputValue('prize').trim();
            const durationStr = interaction.fields.getTextInputValue('duration').trim();
            const winnerCountStr = interaction.fields.getTextInputValue('winner_count').trim();
            let description = '';
            try { description = interaction.fields.getTextInputValue('description').trim(); } catch(e){}

            let imageUrl = null;
            try {
                const rawImg = interaction.fields.getTextInputValue('image_url')?.trim();
                if (rawImg && (rawImg.startsWith('http://') || rawImg.startsWith('https://'))) {
                    imageUrl = rawImg;
                }
            } catch(e){}

            const durationMs = parseDuration(durationStr);
            if (durationMs < 5000) {
                const errPayload = createContainerMessage(
                    'Geçersiz Süre',
                    'Lütfen geçerli bir süre girin. Örn: `1g`, `6sa`, `30dk`, `1d`',
                    COLORS.ERROR || '#ED4245'
                );
                await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
                return true;
            }

            const winnerCount = Math.max(1, Math.min(50, parseInt(winnerCountStr, 10) || 1));
            const draftId = `draft_${interaction.user.id}_${Date.now()}`;

            const draft = {
                id: draftId,
                guildId: interaction.guild.id,
                channelId: interaction.channelId,
                prize,
                durationStr,
                durationMs,
                winnerCount,
                description,
                imageUrl,
                requiredRoleId: null,
                hostId: interaction.user.id
            };

            activeDrafts.set(draftId, draft);

            const draftPayload = await buildDraftPanelPayload(draft);
            await interaction.editReply(draftPayload).catch(() => {});
            return true;
        }

        if (customId.startsWith('gw_modal_reroll:')) {
            await interaction.deferUpdate().catch(() => {});
            const messageId = customId.replace('gw_modal_reroll:', '');
            const countStr = interaction.fields.getTextInputValue('winner_count') || '1';
            const count = parseInt(countStr, 10) || 1;
            const res = await endGiveaway(messageId, interaction.client, true, count);
            if (res.error) {
                const errPayload = createContainerMessage('İşlem Başarısız', res.error, COLORS.ERROR || '#ED4245');
                await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
                return true;
            }
            const gw = await db.getGiveaway(messageId);
            const payload = buildManageGiveawayPayload(gw);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        return true;
    }

    // --- 2. SELECT MENULER ---
    if (interaction.isChannelSelectMenu()) {
        if (customId.startsWith('gw_draft_channel:')) {
            await interaction.deferUpdate().catch(() => {});
            const draftId = customId.replace('gw_draft_channel:', '');
            const draft = activeDrafts.get(draftId);
            if (draft) {
                draft.channelId = interaction.values[0];
                activeDrafts.set(draftId, draft);
                const payload = await buildDraftPanelPayload(draft);
                await interaction.editReply(payload).catch(() => {});
            }
            return true;
        }

        if (customId === 'gw_set_channel_log') {
            await interaction.deferUpdate().catch(() => {});
            const selectedChannelId = interaction.values[0];
            const settings = await db.getGiveawaySettings(interaction.guild.id);
            await db.setGiveawaySettings(interaction.guild.id, {
                ...settings,
                log_channel_id: selectedChannelId
            });
            const payload = await buildSettingsPanelPayload(interaction.guild.id);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }
    }

    if (interaction.isRoleSelectMenu()) {
        if (customId.startsWith('gw_draft_role:')) {
            await interaction.deferUpdate().catch(() => {});
            const draftId = customId.replace('gw_draft_role:', '');
            const draft = activeDrafts.get(draftId);
            if (draft) {
                draft.requiredRoleId = interaction.values[0] || null;
                activeDrafts.set(draftId, draft);
                const payload = await buildDraftPanelPayload(draft);
                await interaction.editReply(payload).catch(() => {});
            }
            return true;
        }

        if (customId.startsWith('gw_cond_select_role:')) {
            await interaction.deferUpdate().catch(() => {});
            const messageId = customId.replace('gw_cond_select_role:', '');
            const selectedRoleId = interaction.values[0];
            await db.pool.query('UPDATE guild_giveaways SET required_role_id = ? WHERE message_id = ?', [selectedRoleId, messageId]);
            const payload = await buildConditionsPanelPayload(messageId);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (customId === 'gw_set_role_ping') {
            await interaction.deferUpdate().catch(() => {});
            const selectedRoleId = interaction.values[0] || null;
            const settings = await db.getGiveawaySettings(interaction.guild.id);
            await db.setGiveawaySettings(interaction.guild.id, {
                ...settings,
                ping_role_id: selectedRoleId
            });
            const payload = await buildSettingsPanelPayload(interaction.guild.id);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (customId === 'gw_set_role_manager') {
            await interaction.deferUpdate().catch(() => {});
            const selectedRoles = interaction.values || [];
            const settings = await db.getGiveawaySettings(interaction.guild.id);
            await db.setGiveawaySettings(interaction.guild.id, {
                ...settings,
                manager_roles: selectedRoles
            });
            const payload = await buildSettingsPanelPayload(interaction.guild.id);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (customId === 'gw_manage_select') {
            await interaction.deferUpdate().catch(() => {});
            const messageId = interaction.values[0];
            const gw = await db.getGiveaway(messageId);
            if (gw) {
                const payload = buildManageGiveawayPayload(gw);
                await interaction.editReply(payload).catch(() => {});
            }
            return true;
        }
    }

    // --- 3. BUTONLAR ---
    const [action, messageId] = customId.split(':');

    if (action === 'gw_new') {
        const modal = new ModalBuilder().setCustomId('gw_modal_start').setTitle('Yeni Çekiliş Oluştur');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('prize').setLabel('Çekiliş Ödülü').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Örn: Nitro Boost, VIP Üyelik')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('duration').setLabel('Çekiliş Süresi').setStyle(TextInputStyle.Short).setRequired(true).setValue('1g').setPlaceholder('Örn: 1g, 12sa, 30dk, 1d')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('winner_count').setLabel('Kazanan Kişi Sayısı').setStyle(TextInputStyle.Short).setRequired(true).setValue('1')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('image_url').setLabel('Görsel / Banner URL (İsteğe Bağlı)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://i.imgur.com/... (Resim linki)')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('description').setLabel('Açıklama & Kurallar (İsteğe Bağlı)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Çekiliş detayları veya katılım şartları...')
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_draft_clear_role') {
        await interaction.deferUpdate().catch(() => {});
        const draft = activeDrafts.get(messageId);
        if (draft) {
            draft.requiredRoleId = null;
            activeDrafts.set(messageId, draft);
            const payload = await buildDraftPanelPayload(draft);
            await interaction.editReply(payload).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_draft_clear_img') {
        await interaction.deferUpdate().catch(() => {});
        const draft = activeDrafts.get(messageId);
        if (draft) {
            draft.imageUrl = null;
            activeDrafts.set(messageId, draft);
            const payload = await buildDraftPanelPayload(draft);
            await interaction.editReply(payload).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_draft_publish') {
        await interaction.deferUpdate().catch(() => {});
        const draft = activeDrafts.get(messageId);
        if (!draft) {
            const payload = await buildMainPanelPayload(interaction.guild.id);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        const targetChannel = interaction.guild.channels.cache.get(draft.channelId) || interaction.channel;
        const endsAt = Date.now() + draft.durationMs;

        const dummyGw = {
            prize: draft.prize,
            description: draft.description || '',
            winner_count: draft.winnerCount,
            required_role_id: draft.requiredRoleId,
            image_url: draft.imageUrl || null,
            host_id: draft.hostId,
            ends_at: endsAt,
            status: 'active',
            participants: [],
            message_id: 'temp'
        };

        const settings = await db.getGiveawaySettings(interaction.guild.id);
        const payload = buildGiveawayPayload(dummyGw, false, [], settings ? settings.show_parts : true);

        const sentMsg = await targetChannel.send(payload).catch(() => null);
        if (!sentMsg) {
            const errPayload = createContainerMessage(
                'Gönderim Hatası',
                `Çekiliş <#${targetChannel.id}> kanalına gönderilemedi. Botun o kanalda mesaj yazma yetkisini kontrol edin.`,
                COLORS.ERROR || '#ED4245'
            );
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        await db.createGiveaway({
            message_id: sentMsg.id,
            channel_id: targetChannel.id,
            guild_id: interaction.guild.id,
            prize: draft.prize,
            description: draft.description || '',
            winner_count: draft.winnerCount,
            required_role_id: draft.requiredRoleId,
            image_url: draft.imageUrl || null,
            host_id: draft.hostId,
            ends_at: endsAt
        });

        const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id }, false, [], settings ? settings.show_parts : true);
        await sentMsg.edit(finalPayload).catch(() => {});

        activeDrafts.delete(messageId);

        const successPayload = createContainerMessage(
            'Çekiliş Başarıyla Başlatıldı!',
            `**${draft.prize}** çekilişi <#${targetChannel.id}> kanalında canlı olarak yayınlandı!`,
            COLORS.SUCCESS || '#57F287',
            [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Çekilişe Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${targetChannel.id}/${sentMsg.id}`).setEmoji(MONO_EMOJIS.external_link || '1537769989669658644'),
                    new ButtonBuilder().setCustomId('gw_home').setLabel('Ana Menüye Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                )
            ]
        );
        successPayload.flags = MessageFlags.IsComponentsV2;
        await interaction.editReply(successPayload).catch(() => {});
        return true;
    }

    if (action === 'gw_settings') {
        await interaction.deferUpdate().catch(() => {});
        const payload = await buildSettingsPanelPayload(interaction.guild.id);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_toggle_dm') {
        await interaction.deferUpdate().catch(() => {});
        const settings = await db.getGiveawaySettings(interaction.guild.id);
        await db.setGiveawaySettings(interaction.guild.id, {
            ...settings,
            dm_winner: !settings.dm_winner
        });
        const payload = await buildSettingsPanelPayload(interaction.guild.id);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_toggle_parts') {
        await interaction.deferUpdate().catch(() => {});
        const settings = await db.getGiveawaySettings(interaction.guild.id);
        await db.setGiveawaySettings(interaction.guild.id, {
            ...settings,
            show_parts: settings.show_parts === false ? true : false
        });
        const payload = await buildSettingsPanelPayload(interaction.guild.id);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_conditions') {
        await interaction.deferUpdate().catch(() => {});
        const payload = await buildConditionsPanelPayload(messageId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_cond_clear') {
        await interaction.deferUpdate().catch(() => {});
        await db.pool.query('UPDATE guild_giveaways SET required_role_id = NULL WHERE message_id = ?', [messageId]);
        const payload = await buildConditionsPanelPayload(messageId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_manage') {
        await interaction.deferUpdate().catch(() => {});
        const gw = await db.getGiveaway(messageId);
        if (gw) {
            const payload = buildManageGiveawayPayload(gw);
            await interaction.editReply(payload).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_list') {
        await interaction.deferUpdate().catch(() => {});
        const payload = await buildGiveawayListPayload(interaction.guild.id);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_home') {
        await interaction.deferUpdate().catch(() => {});
        const payload = await buildMainPanelPayload(interaction.guild.id);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (action === 'gw_forceend') {
        await interaction.deferUpdate().catch(() => {});
        await endGiveaway(messageId, interaction.client);
        const gw = await db.getGiveaway(messageId);
        if (gw) {
            const payload = buildManageGiveawayPayload(gw);
            await interaction.editReply(payload).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_reroll_btn') {
        const modal = new ModalBuilder().setCustomId(`gw_modal_reroll:${messageId}`).setTitle('Yeniden Çekiliş Yap (Reroll)');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('winner_count').setLabel('Yeni Kazanan Sayısı').setStyle(TextInputStyle.Short).setValue('1').setRequired(true)
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_parts_toggle') {
        await interaction.deferUpdate().catch(() => {});
        const gw = await db.getGiveaway(messageId);
        if (gw) {
            const newVal = gw.show_parts === false ? true : false;
            await db.setShowParts(messageId, newVal);
            const updatedGw = await db.getGiveaway(messageId);
            const payload = buildManageGiveawayPayload(updatedGw);
            await interaction.editReply(payload).catch(() => {});

            if (updatedGw.status === 'active') {
                const channel = interaction.client.channels.cache.get(updatedGw.channel_id);
                if (channel) {
                    const msg = await channel.messages.fetch(messageId).catch(() => null);
                    if (msg) {
                        const mainPayload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
                        await msg.edit(mainPayload).catch(() => {});
                    }
                }
            }
        }
        return true;
    }

    if (action === 'gw_cancel') {
        await interaction.deferUpdate().catch(() => {});
        const gw = await db.getGiveaway(messageId);
        if (gw) {
            await db.cancelGiveaway(messageId);
            const payload = buildManageGiveawayPayload({ ...gw, status: 'cancelled' });
            await interaction.editReply(payload).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_join') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gw = await db.getGiveaway(messageId);
        if (!gw || gw.status !== 'active') {
            const errPayload = createContainerMessage('Çekiliş Aktif Değil', 'Bu çekiliş sona ermiş.', COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }
        if (gw.required_role_id && !interaction.member.roles.cache.has(gw.required_role_id)) {
            const roleErr = createContainerMessage('Rol Şartı', `Bu çekilişe katılmak için <@&${gw.required_role_id}> rolüne sahip olmalısınız!`, COLORS.WARNING || '#FEE75C');
            roleErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(roleErr);
        }
        const res = await db.toggleGiveawayParticipant(messageId, interaction.user.id);
        if (!res) {
            const errPayload = createContainerMessage('Hata', 'Katılım işlenirken bir sorun oluştu.', COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }

        // Çekiliş ana mesajını kanalda anında ve garantili şekilde yenileyelim
        try {
            const updatedGw = await db.getGiveaway(messageId);
            const payload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
            
            if (interaction.message && interaction.message.id === messageId) {
                await interaction.message.edit(payload).catch(async () => {
                    const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) await m.edit(payload).catch(() => {});
                    }
                });
            } else {
                const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                if (ch) {
                    const m = await ch.messages.fetch(messageId).catch(() => null);
                    if (m) await m.edit(payload).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[Giveaway Realtime Sync Error]:', e.message);
        }

        if (res.joined) {
            const successPayload = createContainerMessage(
                'Çekilişe Katıldınız!',
                `**${gw.prize}** çekilişine başarıyla katıldınız. Bol şanslar!\n\n<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Güncel Katılımcı: **${res.count} kişi**`,
                COLORS.SUCCESS || '#57F287'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        } else {
            const leavePayload = createContainerMessage(
                'Çekilişten Ayrıldınız',
                `**${gw.prize}** çekilişinden katılımınız geri çekildi.\n\n<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Kalan Katılımcı: **${res.count} kişi**`,
                COLORS.MUTED || '#4F545C'
            );
            leavePayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(leavePayload);
        }
    }

    if (action === 'gw_parts') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gw = await db.getGiveaway(messageId);
        if (!gw) {
            const errPayload = createContainerMessage('Bulunamadı', 'Çekiliş bulunamadı.', COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }
        const parts = gw.participants || [];
        const partsText = parts.length > 0 
            ? parts.slice(0, 30).map((p, idx) => `\`${idx + 1}.\` <@${p}>`).join('\n') + (parts.length > 30 ? `\n*...ve ${parts.length - 30} kişi daha*` : '') 
            : '*Henüz katılımcı bulunmuyor.*';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_parts_refresh:${messageId}`).setLabel('Katılımcıları Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1537768046989410375')
        );

        const listPayload = createContainerMessage(
            `Katılımcılar (${parts.length} Kişi)`,
            `**${gw.prize}** çekilişine katılan üyelerin canlı listesi:\n\n${partsText}`,
            COLORS.PRIMARY || '#5865F2',
            [row]
        );
        listPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
        return interaction.editReply(listPayload);
    }

    if (action === 'gw_parts_refresh') {
        await interaction.deferUpdate().catch(() => {});
        const gw = await db.getGiveaway(messageId);
        if (!gw) return true;
        const parts = gw.participants || [];
        const partsText = parts.length > 0 
            ? parts.slice(0, 30).map((p, idx) => `\`${idx + 1}.\` <@${p}>`).join('\n') + (parts.length > 30 ? `\n*...ve ${parts.length - 30} kişi daha*` : '') 
            : '*Henüz katılımcı bulunmuyor.*';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_parts_refresh:${messageId}`).setLabel('Katılımcıları Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1537768046989410375')
        );

        const listPayload = createContainerMessage(
            `Katılımcılar (${parts.length} Kişi)`,
            `**${gw.prize}** çekilişine katılan üyelerin canlı listesi (Son Güncelleme: <t:${Math.floor(Date.now() / 1000)}:T>):\n\n${partsText}`,
            COLORS.PRIMARY || '#5865F2',
            [row]
        );
        listPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
        await interaction.editReply(listPayload).catch(() => {});
        return true;
    }

    return true;
}

module.exports = {
    buildGiveawayPayload,
    buildManageGiveawayPayload,
    buildGiveawayListPayload,
    buildMainPanelPayload,
    buildSettingsPanelPayload,
    buildConditionsPanelPayload,
    buildDraftPanelPayload,
    parseDuration,
    endGiveaway,
    initGiveawayScheduler,
    handleGiveawayButton
};
