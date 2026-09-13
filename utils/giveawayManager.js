const { 
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, ModalBuilder,
    TextInputBuilder, TextInputStyle, PermissionFlagsBits, MediaGalleryBuilder, MediaGalleryItemBuilder
} = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('./uiBuilder');
const { logGiveaway } = require('./giveawayLogger');
let eventBus;
try {
    eventBus = require('./eventBus');
} catch (e) {}

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

    if (gw.status === 'cancelled') {
        const descText = `<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **${gw.prize}**\n\n` +
            `<:mono:${MONO_EMOJIS.delete || '1531752503237152858'}> **ÇEKİLİŞ İPTAL EDİLDİ**\n\n` +
            `*Bu çekiliş yetkili tarafından iptal edilmiştir.*\n\n` +
            `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
            `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Toplam Katılımcı ›** ${totalParts} kişi`;
        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

    } else if (!isEnded && gw.status === 'paused') {
        const remainingSec = Math.max(0, Math.floor((Number(gw.remaining_time_ms) || 0) / 1000));
        const remMin = Math.floor(remainingSec / 60);
        const remSec = remainingSec % 60;
        const remStr = remMin > 0 ? `${remMin}dk ${remSec}sn` : `${remSec}sn`;

        const descText = `<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **${gw.prize}**\n\n` +
            `<:mono:${MONO_EMOJIS.timer_off || '1548248704023134278'}> **ÇEKİLİŞ GEÇİCİ OLARAK DURDURULDU**\n\n` +
            `${gw.description ? `${gw.description}\n\n` : ''}` +
            `<:mono:${MONO_EMOJIS.timer || '1548249036098633808'}> **Kalan Süre (Donduruldu) ›** \`${remStr}\`\n` +
            `<:mono:${MONO_EMOJIS.trophy || '1542629919379431525'}> **Kazanan Sayısı ›** ${gw.winner_count} kişi\n` +
            `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Katılımcı ›** ${totalParts} kişi\n` +
            `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>\n\n` +
            `*Çekiliş yetkili tarafından duraklatılmıştır. Süre dondurulmuştur, tekrar başlatıldığında kaldığı yerden devam edecektir.*`;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
        mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_join:${gw.message_id}`).setLabel('Durduruldu').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.timer_off || '1548248704023134278').setDisabled(true)
        );
        if (showPartsBtn) {
            row.addComponents(
                new ButtonBuilder().setCustomId(`gw_parts:${gw.message_id}`).setLabel(`Katılanlar (${totalParts})`).setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.users || '1542629930108588153')
            );
        }
        mainContainer.addActionRowComponents(row);

    } else if (!isEnded && gw.status === 'active') {
        let conditionLines = [];
        if (gw.required_role_id) conditionLines.push(`<:mono:${MONO_EMOJIS.shield || '1531753006708822076'}> **Zorunlu Rol ›** <@&${gw.required_role_id}>`);
        if (gw.exempt_roles && Array.isArray(gw.exempt_roles) && gw.exempt_roles.length > 0) {
            conditionLines.push(`<:mono:${MONO_EMOJIS.shield || '1531753006708822076'}> **Yasaklı Roller ›** ${gw.exempt_roles.map(r => `<@&${r}>`).join(', ')}`);
        }
        if (gw.min_account_age_days) conditionLines.push(`<:mono:${MONO_EMOJIS.calendar || '1542629928007114792'}> **Hesap Yaşı Şartı ›** En az ${gw.min_account_age_days} gün`);
        if (gw.min_membership_days) conditionLines.push(`<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Sunucu Üyeliği Şartı ›** En az ${gw.min_membership_days} gün`);
        if (gw.min_boost_tier) conditionLines.push(`<:mono:${MONO_EMOJIS.rocket || '1548248518320193627'}> **Takviye (Boost) Şartı ›** Sunucu Takviyecisi`);
        if (gw.min_messages) conditionLines.push(`<:mono:${MONO_EMOJIS.message_circle || '1548248790350299242'}> **Mesaj Şartı ›** En az ${gw.min_messages} mesaj`);
        if (gw.min_voice_minutes) conditionLines.push(`<:mono:${MONO_EMOJIS.mic || '1548248772620976200'}> **Ses Kanalı Şartı ›** En az ${gw.min_voice_minutes} dakika`);
        if (gw.min_invites) conditionLines.push(`<:mono:${MONO_EMOJIS.invite || '1531752982167949412'}> **Davet Şartı ›** En az ${gw.min_invites} davet`);

        const condBlock = conditionLines.length > 0 ? `\n\n**Katılım Koşulları:**\n${conditionLines.join('\n')}` : '';

        const channelLine = (gw.channel_id && gw.channel_id !== 'undefined') 
            ? `<:mono:${MONO_EMOJIS.info || '1542629911574085725'}> **Kanal ›** <#${gw.channel_id}>\n` 
            : '';

        if (gw.is_drop) {
            const descText = `<:mono:${MONO_EMOJIS.zap || '1548248481586618378'}> **[HIZLI DROP] ${gw.prize}**\n\n` +
                `<:mono:${MONO_EMOJIS.sparkles || '1542629914753241135'}> **İLK TIKLAYAN KAZANIR!** Aşağıdaki butona ilk basan ödülün anında sahibi olur!\n\n` +
                `${gw.description ? `${gw.description}\n\n` : ''}` +
                channelLine +
                `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>` +
                condBlock;

            mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

            if (gw.image_url && typeof gw.image_url === 'string' && gw.image_url.startsWith('http')) {
                const mediaGallery = new MediaGalleryBuilder();
                mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: gw.image_url.trim() } }));
                mainContainer.addMediaGalleryComponents(mediaGallery);
            }

            mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`gw_join:${gw.message_id}`).setLabel('Ödülü Kap!').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.zap || '1548248481586618378')
            );
            mainContainer.addActionRowComponents(row);

        } else {
            const descText = `<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **${gw.prize}**\n\n` +
                `${gw.description ? `${gw.description}\n\n` : ''}` +
                channelLine +
                `<:mono:${MONO_EMOJIS.trophy || '1542629919379431525'}> **Kazanan ›** ${gw.winner_count} kişi\n` +
                `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Katılım ›** ${totalParts} kişi\n` +
                `<:mono:${MONO_EMOJIS.timer || '1548249036098633808'}> **Bitiş ›** <t:${endsEpoch}:R> (<t:${endsEpoch}:F>)\n` +
                `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>` +
                condBlock;

            mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`gw_join:${gw.message_id}`).setLabel('Katıl').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.gift || '1548248258625806426')
            );
            if (showPartsBtn) {
                row.addComponents(
                    new ButtonBuilder().setCustomId(`gw_parts:${gw.message_id}`).setLabel(`Katılanlar (${totalParts})`).setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.users || '1542629930108588153')
                );
            }

            if (gw.image_url && typeof gw.image_url === 'string' && gw.image_url.startsWith('http')) {
                const mediaGallery = new MediaGalleryBuilder();
                mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: gw.image_url.trim() } }));
                mainContainer.addMediaGalleryComponents(mediaGallery);
            }

            mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            mainContainer.addActionRowComponents(row);
        }

    } else {
        // Ended
        const winnerText = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Kazanan çıkmadı';
        const dropBadge = gw.is_drop ? ' [HIZLI DROP]' : '';

        const descText = `<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **${gw.prize}**${dropBadge}\n\n` +
            `<:mono:${MONO_EMOJIS.party_popper || '1548248461206487072'}> **ÇEKİLİŞ SONA ERDİ**\n\n` +
            `${gw.description ? `${gw.description}\n\n` : ''}` +
            `<:mono:${MONO_EMOJIS.trophy || '1542629919379431525'}> **Kazananlar ›** ${winnerText}\n` +
            `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Toplam Katılım ›** ${totalParts} kişi\n` +
            `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
            `<:mono:${MONO_EMOJIS.timer || '1548249036098633808'}> **Bitiş Zamanı ›** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `*Tebrikler! Kazananlar ödülleri için sunucu yetkilileriyle iletişime geçebilir.*`;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

        if (gw.image_url && typeof gw.image_url === 'string' && gw.image_url.startsWith('http')) {
            const mediaGallery = new MediaGalleryBuilder();
            mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: gw.image_url.trim() } }));
            mainContainer.addMediaGalleryComponents(mediaGallery);
        }

        mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const endedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`gw_reroll_direct:${gw.message_id}`)
                .setLabel('Yeniden Çek (Reroll)')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(MONO_EMOJIS.dice_6 || '1548248354994257970')
        );
        if (showPartsBtn) {
            endedRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`gw_parts:${gw.message_id}`)
                    .setLabel(`Katılanlar (${totalParts})`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(MONO_EMOJIS.users || '1542629930108588153')
            );
        }
        mainContainer.addActionRowComponents(endedRow);
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

    let statusText = `<:mono:${MONO_EMOJIS.check || '1531752991265263676'}> **Devam Ediyor**`;
    if (gw.status === 'paused') statusText = `<:mono:${MONO_EMOJIS.timer_off || '1548248704023134278'}> **Duraklatıldı**`;
    else if (gw.status === 'ended') statusText = `<:mono:${MONO_EMOJIS.cross || '1531752989663166625'}> **Sona Erdi**`;
    else if (gw.status === 'cancelled') statusText = `<:mono:${MONO_EMOJIS.delete || '1531752503237152858'}> **İptal Edildi**`;

    let timeText = `<t:${endsEpoch}:F> (<t:${endsEpoch}:R>)`;
    if (gw.is_drop) {
        timeText = `\`İlk Tıklayan Kazanır (Drop)\``;
    } else if (gw.status === 'paused') {
        const remainingSec = Math.max(0, Math.floor((Number(gw.remaining_time_ms) || 0) / 1000));
        const remMin = Math.floor(remainingSec / 60);
        const remSec = remainingSec % 60;
        timeText = `\`${remMin}dk ${remSec}sn\` (Donduruldu)`;
    }

    let conditionLines = [];
    if (gw.required_role_id) conditionLines.push(`• Zorunlu Rol: <@&${gw.required_role_id}>`);
    else conditionLines.push(`• Zorunlu Rol: Yok (Herkes katılabilir)`);
    if (gw.exempt_roles && Array.isArray(gw.exempt_roles) && gw.exempt_roles.length > 0) {
        conditionLines.push(`• Yasaklı Roller: ${gw.exempt_roles.map(r => `<@&${r}>`).join(', ')}`);
    }
    if (gw.min_account_age_days) conditionLines.push(`• Minimum Hesap Yaşı: ${gw.min_account_age_days} gün`);
    if (gw.min_membership_days) conditionLines.push(`• Minimum Sunucu Üyeliği: ${gw.min_membership_days} gün`);
    if (gw.min_boost_tier) conditionLines.push(`• Boost Şartı: Sunucu Takviyecisi`);
    if (gw.min_messages) conditionLines.push(`• Minimum Mesaj: ${gw.min_messages} mesaj`);
    if (gw.min_voice_minutes) conditionLines.push(`• Minimum Ses Kanalı: ${gw.min_voice_minutes} dakika`);
    if (gw.min_invites) conditionLines.push(`• Minimum Davet: ${gw.min_invites} davet`);

    const isDropStr = gw.is_drop ? ` [HIZLI DROP]` : '';

    const descText = `<:mono:${MONO_EMOJIS.settings || '1531753003625742516'}> **Çekiliş Yönetim Paneli**\n\n` +
        `**${gw.prize}**${isDropStr}\n\n` +
        `<:mono:${MONO_EMOJIS.info || '1542629911574085725'}> **Durum ›** ${statusText}\n` +
        `<:mono:${MONO_EMOJIS.info || '1542629911574085725'}> **Kanal ›** <#${gw.channel_id}>\n` +
        `<:mono:${MONO_EMOJIS.trophy || '1542629919379431525'}> **Kazanan Sayısı ›** ${gw.winner_count} kişi\n` +
        `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Katılımcı Sayısı ›** ${totalParts} kişi\n` +
        `<:mono:${MONO_EMOJIS.timer || '1548249036098633808'}> **Bitiş / Kalan Süre ›** ${timeText}\n` +
        `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>\n\n` +
        `<:mono:${MONO_EMOJIS.shield || '1531753006708822076'}> **Katılım Koşulları:**\n${conditionLines.join('\n')}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const isLive = gw.status === 'active' || gw.status === 'paused';

    const row1 = new ActionRowBuilder();
    if (gw.status === 'active' && !gw.is_drop) {
        row1.addComponents(
            new ButtonBuilder().setCustomId(`gw_pause:${gw.message_id}`).setLabel('Duraklat').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.timer_off || '1548248704023134278')
        );
    } else if (gw.status === 'paused' && !gw.is_drop) {
        row1.addComponents(
            new ButtonBuilder().setCustomId(`gw_resume:${gw.message_id}`).setLabel('Devam Ettir').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.zap || '1548248481586618378')
        );
    }
    row1.addComponents(
        new ButtonBuilder().setCustomId(`gw_forceend:${gw.message_id}`).setLabel('Şimdi Bitir').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.trophy || '1542629919379431525').setDisabled(!isLive),
        new ButtonBuilder().setCustomId(`gw_edit_btn:${gw.message_id}`).setLabel('Düzenle').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.pen_tool || '1548248344235610124').setDisabled(!isLive),
        new ButtonBuilder().setCustomId(`gw_reroll_btn:${gw.message_id}`).setLabel('Yeniden Çek (Reroll)').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_cw || '1548249002267381770').setDisabled(gw.status !== 'ended')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_conditions:${gw.message_id}`).setLabel('Koşullar & Şartlar').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.shield || '1531753006708822076'),
        new ButtonBuilder().setCustomId(`gw_parts_toggle:${gw.message_id}`).setLabel(gw.show_parts === false ? 'Katılanlar Butonunu Aç' : 'Katılanlar Butonunu Kapat').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.users || '1542629930108588153'),
        new ButtonBuilder().setCustomId(`gw_cancel:${gw.message_id}`).setLabel('Çekilişi İptal Et').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross || '1531752989663166625').setDisabled(!isLive)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_manage:${gw.message_id}`).setLabel('Paneli Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1548248660486262924'),
        new ButtonBuilder().setCustomId('gw_list').setLabel('Çekiliş Listesi').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1531752499931779082'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Ana Menü').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.settings || '1531753003625742516')
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
    const descText = `<:mono:${MONO_EMOJIS.shield || '1531753006708822076'}> **Çekiliş Katılım Koşulları & Güvenlik Kriterleri**\n\n` +
        `**Çekiliş:** \`${gw.prize}\` (<#${gw.channel_id}>)\n\n` +
        `<:mono:${MONO_EMOJIS.check || '1531752991265263676'}> **Zorunlu Rol ›** ${gw.required_role_id ? `<@&${gw.required_role_id}>` : '`Koşulsuz (Herkes)`'}\n` +
        `<:mono:${MONO_EMOJIS.cross || '1531752989663166625'}> **Yasaklı Roller ›** ${gw.exempt_roles && gw.exempt_roles.length > 0 ? gw.exempt_roles.map(r => `<@&${r}>`).join(', ') : '`Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.calendar || '1542629928007114792'}> **Minimum Hesap Yaşı ›** ${gw.min_account_age_days ? `\`${gw.min_account_age_days} gün\`` : '`Şart Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Minimum Sunucu Üyeliği ›** ${gw.min_membership_days ? `\`${gw.min_membership_days} gün\`` : '`Şart Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.rocket || '1548248518320193627'}> **Boost Şartı ›** ${gw.min_boost_tier ? '`Aktif (Sunucu Takviyecisi)`' : '`Şart Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.message_circle || '1548248790350299242'}> **Minimum Mesaj ›** ${gw.min_messages ? `\`${gw.min_messages} mesaj\`` : '`Şart Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.mic || '1548248772620976200'}> **Minimum Ses Süresi ›** ${gw.min_voice_minutes ? `\`${gw.min_voice_minutes} dakika\`` : '`Şart Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.invite || '1531752982167949412'}> **Minimum Davet ›** ${gw.min_invites ? `\`${gw.min_invites} davet\`` : '`Şart Yok`'}\n\n` +
        `*Aşağıdaki menüleri ve butonları kullanarak rolleri ve güvenlik şartlarını yapılandırabilirsiniz:*`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`gw_cond_select_role:${messageId}`)
        .setPlaceholder('Katılım İçin Zorunlu Rolü Seçin...');

    const exemptSelect = new RoleSelectMenuBuilder()
        .setCustomId(`gw_cond_select_exempt:${messageId}`)
        .setPlaceholder('Yasaklı / Katılamayacak Rolleri Seçin (Max 10)...')
        .setMinValues(0)
        .setMaxValues(10);

    const row1 = new ActionRowBuilder().addComponents(roleSelect);
    const row2 = new ActionRowBuilder().addComponents(exemptSelect);
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_cond_limits_modal:${messageId}`).setLabel('Hesap & Üyelik & Boost').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.calendar || '1542629928007114792'),
        new ButtonBuilder().setCustomId(`gw_cond_activity_modal:${messageId}`).setLabel('Mesaj, Ses & Davet').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.message_circle || '1548248790350299242')
    );
    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_cond_clear:${messageId}`).setLabel('Tüm Şartları Sıfırla').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete || '1531752503237152858'),
        new ButtonBuilder().setCustomId(`gw_manage:${messageId}`).setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1531752499931779082')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);
    container.addActionRowComponents(row4);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildDraftPanelPayload(draft) {
    const endsEpoch = draft.isDrop ? 0 : Math.floor((Date.now() + draft.durationMs) / 1000);
    const container = new ContainerBuilder();

    const dropBadge = draft.isDrop ? ` <:mono:${MONO_EMOJIS.zap || '1548248481586618378'}> **[HIZLI DROP]**` : '';
    const timeStr = draft.isDrop ? '`İlk Tıklayan Kazanır (Süresiz Drop)`' : `\`${draft.durationStr}\` (Bitiş: <t:${endsEpoch}:R>)`;

    const descText = `<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **Yeni Çekiliş Taslağı & Yayınlama Onayı**${dropBadge}\n\n` +
        `<:mono:${MONO_EMOJIS.star || '1548248326787440700'}> **Ödül ›** \`${draft.prize}\`\n` +
        `<:mono:${MONO_EMOJIS.timer || '1548249036098633808'}> **Süre / Tür ›** ${timeStr}\n` +
        `<:mono:${MONO_EMOJIS.trophy || '1542629919379431525'}> **Kazanan Sayısı ›** \`${draft.winnerCount} kişi\`\n` +
        `<:mono:${MONO_EMOJIS.info || '1542629911574085725'}> **Yayınlanacak Kanal ›** <#${draft.channelId}>\n` +
        `<:mono:${MONO_EMOJIS.shield || '1531753006708822076'}> **Zorunlu Rol Şartı ›** ${draft.requiredRoleId ? `<@&${draft.requiredRoleId}>` : '`Yok (Herkes Katılabilir)`'}\n` +
        `<:mono:${MONO_EMOJIS.camera || '1548248497588019280'}> **Görsel / Banner ›** ${draft.imageUrl ? `\`[Görsel Eklendi]\`` : '`Yok`'}\n` +
        `${draft.description ? `\n**Açıklama:**\n> ${draft.description}\n` : ''}\n` +
        `*Aşağıdaki menülerden hedef kanalı ve katılım rolünü seçip **"Çekilişi Başlat"** butonuna basınız:*`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

    if (draft.imageUrl && typeof draft.imageUrl === 'string' && draft.imageUrl.startsWith('http')) {
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
        new ButtonBuilder().setCustomId(`gw_draft_publish:${draft.id}`).setLabel('Çekilişi Başlat').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check || '1531752991265263676'),
        new ButtonBuilder().setCustomId(`gw_draft_clear_role:${draft.id}`).setLabel('Rol Şartını Kaldır').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.delete || '1531752503237152858')
    ];

    if (draft.imageUrl) {
        buttonComponents.push(
            new ButtonBuilder().setCustomId(`gw_draft_clear_img:${draft.id}`).setLabel('Görseli Kaldır').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross || '1531752989663166625')
        );
    }

    buttonComponents.push(
        new ButtonBuilder().setCustomId('gw_home').setLabel('İptal / Geri').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.arrow_left || '1531752499931779082')
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
    const descText = `<:mono:${MONO_EMOJIS.settings || '1531753003625742516'}> **Çekiliş Genel Ayarlar Merkezi**\n\n` +
        `<:mono:${MONO_EMOJIS.info || '1542629911574085725'}> **Log Kanalı ›** ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : '`Kapalı`'}\n` +
        `<:mono:${MONO_EMOJIS.bell || '1542629932847337602'}> **Kazanan Duyuru Rolü (Ping) ›** ${settings.ping_role_id ? `<@&${settings.ping_role_id}>` : '`Yok`'}\n` +
        `<:mono:${MONO_EMOJIS.crown || '1531752492269047992'}> **Yetkili Rolleri ›** ${managerRolesArr.length > 0 ? managerRolesArr.map(r => `<@&${r}>`).join(', ') : '`Yalnızca Sunucu Yöneticileri`'}\n` +
        `<:mono:${MONO_EMOJIS.mail || '1531752976102850786'}> **Kazanana Otomatik DM Bildirimi ›** \`${settings.dm_winner ? 'AÇIK' : 'KAPALI'}\`\n` +
        `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Katılanlar Listesi Butonu ›** \`${settings.show_parts !== false ? 'AÇIK' : 'KAPALI'}\`\n\n` +
        `*Aşağıdaki seçicileri kullanarak log kanalını, duyuru rolünü ve yetkili rollerini yapılandırabilirsiniz:*`;

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
        new ButtonBuilder().setCustomId('gw_toggle_dm').setLabel(`DM Bildirimi: ${settings.dm_winner ? 'Kapat' : 'Aç'}`).setStyle(settings.dm_winner ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.mail || '1531752976102850786'),
        new ButtonBuilder().setCustomId('gw_toggle_parts').setLabel(`Katılanlar Butonu: ${settings.show_parts !== false ? 'Kapat' : 'Aç'}`).setStyle(settings.show_parts !== false ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.users || '1542629930108588153'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Geri (Ana Menü)').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1531752499931779082')
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(channelSelect));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(pingRoleSelect));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(managerRoleSelect));
    container.addActionRowComponents(toggleRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildGiveawayListPayload(guildId) {
    const list = await db.getGuildGiveaways(guildId);
    const activeList = list.filter(g => g.status === 'active' || g.status === 'paused');

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **Aktif Çekilişler Listesi**\nYönetmek istediğiniz çekilişi menüden seçin:`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (activeList.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Şu anda devam eden aktif veya duraklatılmış çekiliş bulunmuyor.`));
    } else {
        const listText = activeList.slice(0, 5).map(gw => {
            const endsEpoch = Math.floor(Number(gw.ends_at) / 1000);
            const statusBadge = gw.status === 'paused' ? `[DURAKLATILDI]` : (gw.is_drop ? `[HIZLI DROP]` : `<t:${endsEpoch}:R>`);
            return `<:mono:${MONO_EMOJIS.star || '1548248326787440700'}> **${gw.prize}** — <#${gw.channel_id}>\n${gw.participants ? gw.participants.length : 0} katılımcı · ${gw.winner_count} kazanan · ${statusBadge}`;
        }).join('\n\n');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(listText));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const selectMenu = new StringSelectMenuBuilder().setCustomId('gw_manage_select').setPlaceholder('Yönetilecek çekilişi seçin...');
        activeList.slice(0, 25).forEach(gw => {
            const prefix = gw.status === 'paused' ? '[DURDURULDU] ' : (gw.is_drop ? '[DROP] ' : '');
            selectMenu.addOptions({ label: (prefix + gw.prize).substring(0, 50), description: `${gw.participants ? gw.participants.length : 0} katılım | ${gw.winner_count} kazanan`, value: gw.message_id });
        });
        container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));
    }

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_list').setLabel('Listeyi Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1548248660486262924'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Ana Menüye Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1531752499931779082')
    );
    container.addActionRowComponents(btnRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildMainPanelPayload(guildId) {
    const settings = await db.getGiveawaySettings(guildId);
    const activeGWs = await db.getGuildGiveaways(guildId);
    const activeCount = activeGWs.filter(g => g.status === 'active' || g.status === 'paused').length;

    let managerRolesArr = [];
    if (settings?.manager_roles) {
        try {
            managerRolesArr = typeof settings.manager_roles === 'string' ? JSON.parse(settings.manager_roles) : settings.manager_roles;
        } catch (e) {
            managerRolesArr = [];
        }
    }

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **Nyx Çekiliş Yönetim Merkezi**`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `Yeni çekiliş veya anlık drop başlatabilir, aktif çekilişleri duraklatıp düzenleyebilir ve sunucu varsayılan ayarlarını yapılandırabilirsiniz.\n\n` +
        `<:mono:${MONO_EMOJIS.crown || '1531752492269047992'}> **Yetkili Rolleri ›** ${managerRolesArr.length > 0 ? managerRolesArr.map(r => `<@&${r}>`).join(', ') : '`Yalnızca Yöneticiler`'}\n` +
        `<:mono:${MONO_EMOJIS.info || '1542629911574085725'}> **Log Kanalı ›** ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : '`Kapalı`'}\n` +
        `<:mono:${MONO_EMOJIS.bell || '1542629932847337602'}> **Duyuru Rolü ›** ${settings.ping_role_id ? `<@&${settings.ping_role_id}>` : '`Kapalı`'}\n` +
        `<:mono:${MONO_EMOJIS.mail || '1531752976102850786'}> **Kazanana DM Bildirimi ›** \`${settings.dm_winner ? 'AÇIK' : 'KAPALI'}\`\n` +
        `<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> **Katılanlar Listesi Butonu ›** \`${settings.show_parts !== false ? 'AÇIK' : 'KAPALI'}\`\n\n` +
        `*Şu anda sunucuda **${activeCount}** aktif/duraklatılmış çekiliş bulunuyor.*`
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_new').setLabel('Yeni Çekiliş').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.add || '1531752983568842842'),
        new ButtonBuilder().setCustomId('gw_new_drop').setLabel('Hızlı Drop').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.zap || '1548248481586618378'),
        new ButtonBuilder().setCustomId('gw_list').setLabel(`Çekilişler (${activeCount})`).setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.search || '1542629925650178118'),
        new ButtonBuilder().setCustomId('gw_settings').setLabel('Genel Ayarlar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.settings || '1531753003625742516'),
        new ButtonBuilder().setCustomId('gw_home').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw || '1548248660486262924')
    );

    container.addActionRowComponents(row1);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function endGiveaway(messageId, client, isReroll = false, customWinnerCount = null, forceWinners = null) {
    logGiveaway('end_start', { messageId, isReroll, customWinnerCount, forceWinners });
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

    let winners = [];

    if (forceWinners && (Array.isArray(forceWinners) ? forceWinners.length > 0 : true)) {
        winners = Array.isArray(forceWinners) ? forceWinners : [forceWinners];
    } else {
        let participants = gw.participants || [];

        // Zorunlu Rol Filtresi
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
        const pool = isReroll ? participants.filter(p => !gw.winners.includes(p)) : [...participants];
        if (isReroll && pool.length === 0) {
            logGiveaway('end_reroll_no_pool', { messageId, totalParticipants: participants.length, previousWinners: gw.winners });
            return { error: 'Yeniden çekiliş için seçilebilecek başka katılımcı bulunmuyor.' };
        }

        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        for (let i = 0; i < Math.min(count, pool.length); i++) {
            winners.push(pool[i]);
        }
    }

    logGiveaway('end_winners_selected', { messageId, totalParticipants: gw.participants?.length || 0, winners });

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
        
        const announceTitle = isReroll
            ? `<:mono:${MONO_EMOJIS.dice_6 || '1548248354994257970'}> **YENİDEN ÇEKİLİŞ SONUCU (REROLL)**`
            : (gw.is_drop ? `<:mono:${MONO_EMOJIS.zap || '1548248481586618378'}> **[HIZLI DROP] KAZANAN BELİRLENDİ!**` : `<:mono:${MONO_EMOJIS.party_popper || '1548248461206487072'}> **ÇEKİLİŞ SONUCU**`);
        const actionDesc = gw.is_drop ? `butona ilk basarak ödülü kaptı!` : (isReroll ? `yapılan yeniden çekilişte kazandı!` : `kazandı!`);

        const descText = `<:mono:${MONO_EMOJIS.gift || '1548248258625806426'}> **${gw.prize}**\n\n${announceTitle}\n\n${winnerPings} ${actionDesc}\n<:mono:${MONO_EMOJIS.user || '1542629922525159484'}> **Düzenleyen ›** <@${gw.host_id}>`;
        announceContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Çekilişe Git')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`)
                .setEmoji(MONO_EMOJIS.link || '1542629903134883880')
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

    if (eventBus) {
        try {
            eventBus.emitEvent('giveaway_update', {
                guildId: gw.guild_id,
                messageId,
                action: 'ended',
                winners
            });
        } catch (e) {}
    }

    return { success: true, winners };
}

let lastPeriodicSync = 0;
function initGiveawayScheduler(client) {
    setInterval(async () => {
        try {
            const activeList = await db.getActiveGiveaways().catch(() => []);
            const now = Date.now();

            for (const gw of activeList) {
                // Yalnızca aktif ve drop olmayan çekilişler süre bitiminde otomatik sonlandırılır
                if (gw.status === 'active' && !gw.is_drop && !gw.paused && now >= Number(gw.ends_at)) {
                    logGiveaway('scheduler_ending', { messageId: gw.message_id, endsAt: gw.ends_at });
                    await endGiveaway(gw.message_id, client).catch((e) => logGiveaway('scheduler_end_error', { messageId: gw.message_id, error: e.message }));
                }
            }

            // Her 60 saniyede bir aktif çekiliş mesajlarını kanallarda otomatik tazele
            if (now - lastPeriodicSync > 60000 && activeList.length > 0) {
                lastPeriodicSync = now;
                for (const gw of activeList) {
                    if (gw.status === 'active' && !gw.paused) {
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
                isDrop: false,
                hostId: interaction.user.id
            };

            activeDrafts.set(draftId, draft);

            const draftPayload = await buildDraftPanelPayload(draft);
            await interaction.editReply(draftPayload).catch(() => {});
            return true;
        }

        if (customId === 'gw_modal_drop') {
            await interaction.deferUpdate().catch(() => {});
            const prize = interaction.fields.getTextInputValue('prize').trim();
            let description = '';
            try { description = interaction.fields.getTextInputValue('description').trim(); } catch(e){}

            let imageUrl = null;
            try {
                const rawImg = interaction.fields.getTextInputValue('image_url')?.trim();
                if (rawImg && (rawImg.startsWith('http://') || rawImg.startsWith('https://'))) {
                    imageUrl = rawImg;
                }
            } catch(e){}

            const draftId = `draft_drop_${interaction.user.id}_${Date.now()}`;

            const draft = {
                id: draftId,
                guildId: interaction.guild.id,
                channelId: interaction.channelId,
                prize,
                durationStr: 'Hızlı Drop (İlk Tıklayan Kazanır)',
                durationMs: 30 * 24 * 60 * 60 * 1000,
                winnerCount: 1,
                description,
                imageUrl,
                requiredRoleId: null,
                isDrop: true,
                hostId: interaction.user.id
            };

            activeDrafts.set(draftId, draft);

            const draftPayload = await buildDraftPanelPayload(draft);
            await interaction.editReply(draftPayload).catch(() => {});
            return true;
        }

        if (customId.startsWith('gw_modal_edit:')) {
            await interaction.deferUpdate().catch(() => {});
            const messageId = customId.replace('gw_modal_edit:', '');
            const prize = interaction.fields.getTextInputValue('prize').trim();
            const extraTimeStr = interaction.fields.getTextInputValue('extra_time')?.trim() || '';
            const winnerCountStr = interaction.fields.getTextInputValue('winner_count')?.trim() || '1';
            let description = '';
            try { description = interaction.fields.getTextInputValue('description').trim(); } catch(e){}

            const extraTimeMs = extraTimeStr && extraTimeStr !== '0' ? parseDuration(extraTimeStr) : 0;
            const winnerCount = Math.max(1, Math.min(50, parseInt(winnerCountStr, 10) || 1));

            const editRes = await db.editGiveaway(messageId, {
                prize,
                extraTimeMs,
                winnerCount,
                description
            });

            if (editRes.error) {
                const errPayload = createContainerMessage('Düzenleme Hatası', editRes.error, COLORS.ERROR || '#ED4245');
                await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
                return true;
            }

            const updatedGw = await db.getGiveaway(messageId);
            if (updatedGw) {
                // Kanal mesajını güncelle
                try {
                    const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) {
                            const payload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
                            await m.edit(payload).catch(() => {});
                        }
                    }
                } catch (e) {}

                // Paneli güncelle
                const panelPayload = buildManageGiveawayPayload(updatedGw);
                await interaction.editReply(panelPayload).catch(() => {});
            }
            return true;
        }

        if (customId.startsWith('gw_modal_cond_limits:')) {
            await interaction.deferUpdate().catch(() => {});
            const messageId = customId.replace('gw_modal_cond_limits:', '');
            const minAccAgeStr = interaction.fields.getTextInputValue('min_account_age')?.trim() || '';
            const minMemberStr = interaction.fields.getTextInputValue('min_membership')?.trim() || '';
            const minBoostStr = interaction.fields.getTextInputValue('min_boost')?.trim() || '';

            const minAccAge = minAccAgeStr ? parseInt(minAccAgeStr, 10) || null : null;
            const minMember = minMemberStr ? parseInt(minMemberStr, 10) || null : null;
            const minBoost = minBoostStr === '1' ? 1 : null;

            const currentGw = await db.getGiveaway(messageId);
            if (currentGw) {
                await db.setGiveawayConditions(messageId, {
                    required_role_id: currentGw.required_role_id,
                    exempt_roles: currentGw.exempt_roles,
                    min_account_age_days: minAccAge,
                    min_membership_days: minMember,
                    min_boost_tier: minBoost,
                    min_messages: currentGw.min_messages,
                    min_voice_minutes: currentGw.min_voice_minutes,
                    min_invites: currentGw.min_invites
                });

                const updatedGw = await db.getGiveaway(messageId);
                // Kanal mesajını güncelle
                try {
                    const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) {
                            const payload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
                            await m.edit(payload).catch(() => {});
                        }
                    }
                } catch (e) {}

                const panelPayload = await buildConditionsPanelPayload(messageId);
                await interaction.editReply(panelPayload).catch(() => {});
            }
            return true;
        }

        if (customId.startsWith('gw_modal_cond_activity:')) {
            await interaction.deferUpdate().catch(() => {});
            const messageId = customId.replace('gw_modal_cond_activity:', '');
            const minMsgStr = interaction.fields.getTextInputValue('min_messages')?.trim() || '';
            const minVoiceStr = interaction.fields.getTextInputValue('min_voice_minutes')?.trim() || '';
            const minInviteStr = interaction.fields.getTextInputValue('min_invites')?.trim() || '';

            const minMessages = minMsgStr ? parseInt(minMsgStr, 10) || null : null;
            const minVoiceMinutes = minVoiceStr ? parseInt(minVoiceStr, 10) || null : null;
            const minInvites = minInviteStr ? parseInt(minInviteStr, 10) || null : null;

            const currentGw = await db.getGiveaway(messageId);
            if (currentGw) {
                await db.setGiveawayConditions(messageId, {
                    required_role_id: currentGw.required_role_id,
                    exempt_roles: currentGw.exempt_roles,
                    min_account_age_days: currentGw.min_account_age_days,
                    min_membership_days: currentGw.min_membership_days,
                    min_boost_tier: currentGw.min_boost_tier,
                    min_messages: minMessages,
                    min_voice_minutes: minVoiceMinutes,
                    min_invites: minInvites
                });

                const updatedGw = await db.getGiveaway(messageId);
                // Kanal mesajını güncelle
                try {
                    const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) {
                            const payload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
                            await m.edit(payload).catch(() => {});
                        }
                    }
                } catch (e) {}

                const panelPayload = await buildConditionsPanelPayload(messageId);
                await interaction.editReply(panelPayload).catch(() => {});
            }
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
            const selectedRoleId = interaction.values[0] || null;
            const currentGw = await db.getGiveaway(messageId);
            if (currentGw) {
                await db.setGiveawayConditions(messageId, {
                    required_role_id: selectedRoleId,
                    exempt_roles: currentGw.exempt_roles,
                    min_account_age_days: currentGw.min_account_age_days,
                    min_membership_days: currentGw.min_membership_days,
                    min_boost_tier: currentGw.min_boost_tier,
                    min_messages: currentGw.min_messages,
                    min_voice_minutes: currentGw.min_voice_minutes,
                    min_invites: currentGw.min_invites
                });
                const updatedGw = await db.getGiveaway(messageId);
                try {
                    const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                    }
                } catch (e) {}
            }
            const payload = await buildConditionsPanelPayload(messageId);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (customId.startsWith('gw_cond_select_exempt:')) {
            await interaction.deferUpdate().catch(() => {});
            const messageId = customId.replace('gw_cond_select_exempt:', '');
            const selectedExempt = interaction.values || [];
            const currentGw = await db.getGiveaway(messageId);
            if (currentGw) {
                await db.setGiveawayConditions(messageId, {
                    required_role_id: currentGw.required_role_id,
                    exempt_roles: selectedExempt,
                    min_account_age_days: currentGw.min_account_age_days,
                    min_membership_days: currentGw.min_membership_days,
                    min_boost_tier: currentGw.min_boost_tier,
                    min_messages: currentGw.min_messages,
                    min_voice_minutes: currentGw.min_voice_minutes,
                    min_invites: currentGw.min_invites
                });
                const updatedGw = await db.getGiveaway(messageId);
                try {
                    const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                    }
                } catch (e) {}
            }
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
        const modal = new ModalBuilder().setCustomId('gw_modal_start').setTitle('Yeni Süreli Çekiliş');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('prize').setLabel('Çekiliş Ödülü').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Örn: Discord Nitro Boost')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('duration').setLabel('Çekiliş Süresi').setStyle(TextInputStyle.Short).setRequired(true).setValue('1g').setPlaceholder('Örn: 1g, 12sa, 30dk, 1d')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('winner_count').setLabel('Kazanan Kişi Sayısı').setStyle(TextInputStyle.Short).setRequired(true).setValue('1')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('image_url').setLabel('Görsel / Banner URL (İsteğe Bağlı)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://... (Resim linki)')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('description').setLabel('Açıklama & Kurallar (İsteğe Bağlı)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Çekiliş detayları veya katılım şartları...')
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_new_drop') {
        const modal = new ModalBuilder().setCustomId('gw_modal_drop').setTitle('Hızlı Drop Çekilişi (İlk Tıklayan)');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('prize').setLabel('Drop Ödülü').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Örn: Steam Cüzdan Kodu, Özel Rol')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('image_url').setLabel('Görsel / Banner URL (İsteğe Bağlı)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://... (Resim linki)')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('description').setLabel('Açıklama & Not (İsteğe Bağlı)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Hızlı olan kazanır!')
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_edit_btn') {
        const gw = await db.getGiveaway(messageId);
        if (!gw) return true;
        const modal = new ModalBuilder().setCustomId(`gw_modal_edit:${messageId}`).setTitle('Çekilişi Düzenle');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('prize').setLabel('Ödül Adı').setStyle(TextInputStyle.Short).setValue(gw.prize || '').setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('extra_time').setLabel('Eklenecek Ek Süre (0 = Değişmez)').setStyle(TextInputStyle.Short).setValue('0').setPlaceholder('Örn: 1g, 6sa, 30dk, 0').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('winner_count').setLabel('Kazanan Sayısı').setStyle(TextInputStyle.Short).setValue(String(gw.winner_count || 1)).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('description').setLabel('Açıklama & Kurallar').setStyle(TextInputStyle.Paragraph).setValue(gw.description || '').setRequired(false)
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_cond_limits_modal') {
        const gw = await db.getGiveaway(messageId);
        if (!gw) return true;
        const modal = new ModalBuilder().setCustomId(`gw_modal_cond_limits:${messageId}`).setTitle('Hesap, Üyelik & Boost Şartları');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('min_account_age').setLabel('Minimum Hesap Yaşı (Gün)').setStyle(TextInputStyle.Short).setValue(gw.min_account_age_days ? String(gw.min_account_age_days) : '').setPlaceholder('Örn: 7 (Boş = Şart yok)').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('min_membership').setLabel('Minimum Sunucu Üyeliği (Gün)').setStyle(TextInputStyle.Short).setValue(gw.min_membership_days ? String(gw.min_membership_days) : '').setPlaceholder('Örn: 3 (Boş = Şart yok)').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('min_boost').setLabel('Sunucu Boost Şartı (1: Zorunlu, 0: Yok)').setStyle(TextInputStyle.Short).setValue(gw.min_boost_tier ? '1' : '0').setPlaceholder('0 veya 1').setRequired(false)
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_cond_activity_modal') {
        const gw = await db.getGiveaway(messageId);
        if (!gw) return true;
        const modal = new ModalBuilder().setCustomId(`gw_modal_cond_activity:${messageId}`).setTitle('Mesaj, Ses & Davet Şartları');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('min_messages').setLabel('Minimum Mesaj Sayısı').setStyle(TextInputStyle.Short).setValue(gw.min_messages ? String(gw.min_messages) : '').setPlaceholder('Örn: 50 (Boş = Şart yok)').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('min_voice_minutes').setLabel('Minimum Ses Kanalı Süresi (Dakika)').setStyle(TextInputStyle.Short).setValue(gw.min_voice_minutes ? String(gw.min_voice_minutes) : '').setPlaceholder('Örn: 60 (Boş = Şart yok)').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('min_invites').setLabel('Minimum Davet Sayısı').setStyle(TextInputStyle.Short).setValue(gw.min_invites ? String(gw.min_invites) : '').setPlaceholder('Örn: 3 (Boş = Şart yok)').setRequired(false)
            )
        );
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    if (action === 'gw_pause') {
        await interaction.deferUpdate().catch(() => {});
        const res = await db.pauseGiveaway(messageId);
        if (res.error) {
            const errPayload = createContainerMessage('Hata', res.error, COLORS.ERROR || '#ED4245');
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const updatedGw = await db.getGiveaway(messageId);
        if (updatedGw) {
            try {
                const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                if (ch) {
                    const m = await ch.messages.fetch(messageId).catch(() => null);
                    if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                }
            } catch (e) {}

            const panel = buildManageGiveawayPayload(updatedGw);
            await interaction.editReply(panel).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_resume') {
        await interaction.deferUpdate().catch(() => {});
        const res = await db.resumeGiveaway(messageId);
        if (res.error) {
            const errPayload = createContainerMessage('Hata', res.error, COLORS.ERROR || '#ED4245');
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const updatedGw = await db.getGiveaway(messageId);
        if (updatedGw) {
            try {
                const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                if (ch) {
                    const m = await ch.messages.fetch(messageId).catch(() => null);
                    if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                }
            } catch (e) {}

            const panel = buildManageGiveawayPayload(updatedGw);
            await interaction.editReply(panel).catch(() => {});
        }
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
        const endsAt = draft.isDrop ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + draft.durationMs;

        const dummyGw = {
            prize: draft.prize,
            description: draft.description || '',
            winner_count: draft.winnerCount,
            required_role_id: draft.requiredRoleId,
            exempt_roles: [],
            min_account_age_days: null,
            min_membership_days: null,
            min_boost_tier: null,
            min_messages: null,
            min_voice_minutes: null,
            min_invites: null,
            image_url: draft.imageUrl || null,
            host_id: draft.hostId,
            channel_id: targetChannel.id,
            guild_id: interaction.guild.id,
            ends_at: endsAt,
            status: 'active',
            is_drop: draft.isDrop ? true : false,
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
            ends_at: endsAt,
            is_drop: draft.isDrop ? 1 : 0
        });

        const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id, channel_id: targetChannel.id, guild_id: interaction.guild.id }, false, [], settings ? settings.show_parts : true);
        await sentMsg.edit(finalPayload).catch(() => {});

        activeDrafts.delete(messageId);

        if (eventBus) {
            try {
                eventBus.emitEvent('giveaway_update', {
                    guildId: interaction.guild.id,
                    messageId: sentMsg.id,
                    action: 'created'
                });
            } catch (e) {}
        }

        const successPayload = createContainerMessage(
            'Çekiliş Başarıyla Başlatıldı!',
            `**${draft.prize}** çekilişi <#${targetChannel.id}> kanalında canlı olarak yayınlandı!`,
            COLORS.SUCCESS || '#57F287',
            [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Çekilişe Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${targetChannel.id}/${sentMsg.id}`).setEmoji(MONO_EMOJIS.link || '1542629903134883880'),
                    new ButtonBuilder().setCustomId('gw_home').setLabel('Ana Menüye Dön').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1531752499931779082')
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
        await db.setGiveawayConditions(messageId, {
            required_role_id: null,
            exempt_roles: [],
            min_account_age_days: null,
            min_membership_days: null,
            min_boost_tier: null,
            min_messages: null,
            min_voice_minutes: null,
            min_invites: null
        });
        const updatedGw = await db.getGiveaway(messageId);
        if (updatedGw) {
            try {
                const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                if (ch) {
                    const m = await ch.messages.fetch(messageId).catch(() => null);
                    if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                }
            } catch (e) {}
        }
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

            if (updatedGw.status === 'active' || updatedGw.status === 'paused') {
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
            const updatedGw = await db.getGiveaway(messageId);
            try {
                const ch = interaction.guild?.channels.cache.get(updatedGw.channel_id);
                if (ch) {
                    const m = await ch.messages.fetch(messageId).catch(() => null);
                    if (m) await m.edit(buildGiveawayPayload(updatedGw, true, [])).catch(() => {});
                }
            } catch (e) {}

            const payload = buildManageGiveawayPayload(updatedGw);
            await interaction.editReply(payload).catch(() => {});
        }
        return true;
    }

    if (action === 'gw_reroll_direct') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await endGiveaway(messageId, interaction.client, true, 1);
        if (res.error) {
            const errPayload = createContainerMessage('Yeniden Çekiliş Hatası', res.error, COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }
        const winnerPings = res.winners && res.winners.length > 0 ? res.winners.map(w => `<@${w}>`).join(', ') : 'Kazanan çıkmadı';
        const okPayload = createContainerMessage(
            'Yeniden Çekildi!',
            `Yeni kazanan belirlendi ve çekiliş kanalına duyuruldu.\n\n<:mono:${MONO_EMOJIS.trophy || '1542629919379431525'}> **Yeni Kazanan ›** ${winnerPings}`,
            COLORS.SUCCESS || '#57F287'
        );
        okPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
        return interaction.editReply(okPayload);
    }

    if (action === 'gw_join') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gw = await db.getGiveaway(messageId);
        if (!gw) {
            const errPayload = createContainerMessage('Çekiliş Bulunamadı', 'Çekiliş veritabanında bulunamadı.', COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }

        if (gw.status === 'paused') {
            const errPayload = createContainerMessage('Çekiliş Duraklatıldı', 'Bu çekiliş şu anda yönetici tarafından duraklatılmıştır. Tekrar başlatıldığında katılabilirsiniz.', COLORS.WARNING || '#FEE75C');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }

        if (gw.status !== 'active') {
            const errPayload = createContainerMessage('Çekiliş Aktif Değil', 'Bu çekiliş sona ermiş veya iptal edilmiştir.', COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }

        // 1. Yasaklı / Muaf Roller Kontrolü
        if (gw.exempt_roles && Array.isArray(gw.exempt_roles) && gw.exempt_roles.length > 0) {
            const hasExempt = gw.exempt_roles.some(r => interaction.member.roles.cache.has(r));
            if (hasExempt) {
                const roleErr = createContainerMessage('Katılım Kısıtlaması', 'Sahip olduğunuz bir rol nedeniyle bu çekilişe katılım hakkınız kısıtlanmıştır.', COLORS.ERROR || '#ED4245');
                roleErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(roleErr);
            }
        }

        // 2. Zorunlu Rol Kontrolü
        if (gw.required_role_id && !interaction.member.roles.cache.has(gw.required_role_id)) {
            const roleErr = createContainerMessage('Rol Şartı', `Bu çekilişe katılmak için <@&${gw.required_role_id}> rolüne sahip olmalısınız!`, COLORS.WARNING || '#FEE75C');
            roleErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(roleErr);
        }

        // 3. Minimum Hesap Yaşı Kontrolü
        if (gw.min_account_age_days) {
            const accDays = Math.floor((Date.now() - interaction.user.createdTimestamp) / (24 * 60 * 60 * 1000));
            if (accDays < gw.min_account_age_days) {
                const ageErr = createContainerMessage('Hesap Yaşı Yetersiz', `Bu çekilişe katılabilmek için Discord hesabınız en az **${gw.min_account_age_days} günlük** olmalıdır.\n(Mevcut: **${accDays} gün**)`, COLORS.ERROR || '#ED4245');
                ageErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(ageErr);
            }
        }

        // 4. Minimum Sunucu Üyeliği Kontrolü
        if (gw.min_membership_days) {
            const memberDays = Math.floor((Date.now() - (interaction.member.joinedTimestamp || Date.now())) / (24 * 60 * 60 * 1000));
            if (memberDays < gw.min_membership_days) {
                const memberErr = createContainerMessage('Sunucu Üyeliği Yetersiz', `Bu çekilişe katılabilmek için bu sunucuda en az **${gw.min_membership_days} gündür** bulunuyor olmalısınız.\n(Mevcut: **${memberDays} gün**)`, COLORS.ERROR || '#ED4245');
                memberErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(memberErr);
            }
        }

        // 5. Boost Kontrolü
        if (gw.min_boost_tier && !interaction.member.premiumSince) {
            const boostErr = createContainerMessage('Boost Şartı', 'Bu çekilişe yalnızca bu sunucuya takviye (boost) yapmış üyeler katılabilir.', COLORS.ERROR || '#ED4245');
            boostErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(boostErr);
        }

        // 6. Aktivite Şartları (Mesaj, Ses, Davet)
        if (gw.min_messages || gw.min_voice_minutes || gw.min_invites) {
            const levelUser = await db.getLevelUser(gw.guild_id, interaction.user.id);

            // Mesaj Şartı
            if (gw.min_messages && (levelUser.messages || 0) < gw.min_messages) {
                const msgErr = createContainerMessage(
                    'Mesaj Şartı Yetersiz',
                    `Bu çekilişe katılabilmek için sunucuda en az **${gw.min_messages} adet** mesaj göndermiş olmalısınız.\n(Mevcut Mesajınız: **${levelUser.messages || 0}**)`,
                    COLORS.ERROR || '#ED4245'
                );
                msgErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(msgErr);
            }

            // Ses Kanalı Süresi Şartı
            const voiceMins = Math.floor((levelUser.voice_secs || 0) / 60);
            if (gw.min_voice_minutes && voiceMins < gw.min_voice_minutes) {
                const voiceErr = createContainerMessage(
                    'Ses Kanalı Süresi Yetersiz',
                    `Bu çekilişe katılabilmek için sunucu ses kanallarında en az **${gw.min_voice_minutes} dakika** geçirmiş olmalısınız.\n(Mevcut Ses Süreniz: **${voiceMins} dakika**)`,
                    COLORS.ERROR || '#ED4245'
                );
                voiceErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(voiceErr);
            }

            // Davet Şartı
            if (gw.min_invites && (levelUser.invites || 0) < gw.min_invites) {
                const inviteErr = createContainerMessage(
                    'Davet Şartı Yetersiz',
                    `Bu çekilişe katılabilmek için sunucuya en az **${gw.min_invites} kişi** davet etmiş olmalısınız.\n(Mevcut Davetiniz: **${levelUser.invites || 0}**)`,
                    COLORS.ERROR || '#ED4245'
                );
                inviteErr.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(inviteErr);
            }
        }

        // --- HIZLI DROP İŞLEYİŞİ ---
        if (gw.is_drop) {
            await endGiveaway(messageId, interaction.client, false, 1, [interaction.user.id]);
            const winPayload = createContainerMessage(
                'Ödülü Kazandınız!',
                `Tebrikler! Butona ilk basan kişi siz oldunuz ve **${gw.prize}** ödülünü anında kazandınız!`,
                COLORS.SUCCESS || '#57F287'
            );
            winPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(winPayload);
        }

        // --- STANDART ÇEKİLİŞ KATILIMI ---
        const res = await db.toggleGiveawayParticipant(messageId, interaction.user.id);
        if (!res) {
            const errPayload = createContainerMessage('Hata', 'Katılım işlenirken bir sorun oluştu.', COLORS.ERROR || '#ED4245');
            errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(errPayload);
        }

        if (eventBus) {
            try {
                eventBus.emitEvent('giveaway_update', {
                    guildId: interaction.guild?.id,
                    messageId,
                    action: 'participant_changed',
                    userId: interaction.user.id,
                    joined: res.joined
                });
            } catch (e) {}
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
                `**${gw.prize}** çekilişine başarıyla katıldınız. Bol şanslar!\n\n<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> Güncel Katılımcı: **${res.count} kişi**`,
                COLORS.SUCCESS || '#57F287'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        } else {
            const leavePayload = createContainerMessage(
                'Çekilişten Ayrıldınız',
                `**${gw.prize}** çekilişinden katılımınız geri çekildi.\n\n<:mono:${MONO_EMOJIS.users || '1542629930108588153'}> Kalan Katılımcı: **${res.count} kişi**`,
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
            new ButtonBuilder().setCustomId(`gw_parts_refresh:${messageId}`).setLabel('Katılımcıları Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1548248660486262924')
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
            new ButtonBuilder().setCustomId(`gw_parts_refresh:${messageId}`).setLabel('Katılımcıları Yenile').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh_ccw || '1548248660486262924')
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
