const { 
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder 
} = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const { logGiveaway } = require('./giveawayLogger');

function buildGiveawayPayload(gw, isEnded = false, winners = [], showPartsBtn = true) {
    const totalParts = gw.participants ? gw.participants.length : 0;
    const endsEpoch = Math.floor(gw.ends_at / 1000);

    const mainContainer = new ContainerBuilder();

    if (!isEnded && gw.status === 'active') {
        const descText = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> **${gw.prize}**\n\n` +
            `${gw.description ? `${gw.description}\n\n` : ''}` +
            `<:mono:${MONO_EMOJIS.hash || '1537770187129094267'}> **Kanal ›** <#${gw.channel_id}>\n` +
            `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazanan ›** ${gw.winner_count} kişi\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Katılım ›** ${totalParts} kişi\n` +
            `<:mono:${MONO_EMOJIS.clock || '1537769987647733831'}> **Bitiş ›** <t:${endsEpoch}:R>\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>`;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_join:${gw.message_id}`).setLabel(`Katıl`).setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.star || '1530917515227725834')
        );
        if (showPartsBtn) {
            row.addComponents(
                new ButtonBuilder().setCustomId(`gw_parts:${gw.message_id}`).setLabel('Katılanlar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user || '1537768132062486558')
            );
        }
        
        mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        mainContainer.addActionRowComponents(row);

    } else {
        const winnerText = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Kazanan çıkmadı';
        
        const descText = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> **${gw.prize}**\n\nÇEKİLİŞ BİTTİ\n\n${gw.description ? `${gw.description}\n\n` : ''}` +
            `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazanan ›** ${winnerText}\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Katılım ›** ${totalParts} kişi\n` +
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
            `<:mono:${MONO_EMOJIS.clock || '1537769987647733831'}> **Bitti ›** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `Kazananlar aşağıdaki duyuruda etiketlendi.`;

        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [mainContainer]
    };
}

function buildManageGiveawayPayload(gw) {
    const totalParts = gw.participants ? gw.participants.length : 0;
    const endsEpoch = Math.floor(gw.ends_at / 1000);

    const container = new ContainerBuilder();
    
    const descText = `<:mono:${MONO_EMOJIS.settings || '1530917467650523176'}> **Çekiliş Yönetimi**\n\n**${gw.prize}**\n\n` +
        `<:mono:${MONO_EMOJIS.hash || '1537770187129094267'}> **Kanal ›** <#${gw.channel_id}>\n` +
        `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}> **Kazanan ›** ${gw.winner_count} kişi\n` +
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Katılım ›** ${totalParts} kişi\n` +
        `<:mono:${MONO_EMOJIS.clock || '1537768132062486558'}> **Bitiş ›** <t:${endsEpoch}:F>\n` +
        `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>\n` +
        `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> **Durum ›** ${gw.status === 'active' ? 'Devam ediyor' : 'Sona Erdi'}\n\n` +
        `${gw.required_role_id ? `Katılım koşulu var: <@&${gw.required_role_id}>` : 'Katılım koşulu yok — herkes katılabilir.'}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Bitir: kazananı hemen çeker. İptal: kazanan çekmeden kapatır.\nÇekiliş <#${gw.channel_id}> kanalında başladı.`));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_forceend:${gw.message_id}`).setLabel('Şimdi Bitir').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.trophy || '1537767825937010708').setDisabled(gw.status !== 'active'),
        new ButtonBuilder().setCustomId(`gw_conditions:${gw.message_id}`).setLabel('Koşullar').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.shield || '1530917506867400775').setDisabled(true) // SS2'de koşullar var
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_parts_toggle:${gw.message_id}`).setLabel(gw.show_parts === false ? 'Katılanları Göster' : 'Katılanları Gizle').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.user || '1537768132062486558'),
        new ButtonBuilder().setCustomId(`gw_cancel:${gw.message_id}`).setLabel('İptal Et').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.octagon || '1537769843099701298').setDisabled(gw.status !== 'active')
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_home').setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildGiveawayListPayload(guildId) {
    const list = await db.getGuildGiveaways(guildId);
    const activeList = list.filter(g => g.status === 'active');

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> **Aktif Çekilişler**\nYönetmek istediğin çekilişi menüden seç.`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (activeList.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Şu anda aktif çekiliş yok.`));
    } else {
        const listText = activeList.slice(0, 5).map(gw => {
            const endsEpoch = Math.floor(gw.ends_at / 1000);
            return `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> **${gw.prize}** — <#${gw.channel_id}>\n${gw.participants ? gw.participants.length : 0} katılımcı · ${gw.winner_count} kazanan · <t:${endsEpoch}:R>`;
        }).join('\n\n');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(listText));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const selectMenu = new StringSelectMenuBuilder().setCustomId('gw_manage_select').setPlaceholder('Yönetilecek çekilişi seç...');
        activeList.slice(0, 25).forEach(gw => {
            selectMenu.addOptions({ label: gw.prize.substring(0, 50), description: `${gw.participants ? gw.participants.length : 0} katılım | ${gw.winner_count} kazanan`, value: gw.message_id });
        });
        container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));
    }

    const btnRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw_home').setLabel('Geri').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161'));
    container.addActionRowComponents(btnRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function buildMainPanelPayload(guildId) {
    const settings = await db.getGiveawaySettings(guildId);
    const activeGWs = await db.getGuildGiveaways(guildId);
    const activeCount = activeGWs.filter(g => g.status === 'active').length;

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Çekiliş Sistemi`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `Çekiliş açmak için kuruluma gerek yok — \`/giveaway 1g 1 Nitro\` yazman yeterli.\nAşağıdaki ayarlar yalnızca varsayılanları değiştirir.\n\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Yetkili Rolleri** › ${settings.manager_roles.length > 0 ? settings.manager_roles.map(r => `<@&${r}>`).join(', ') : 'sadece Sunucuyu Yönet yetkisi'}\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Log Kanalı** › ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : 'kapalı'}\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Duyuru Rolü** › ${settings.ping_role_id ? `<@&${settings.ping_role_id}>` : 'kapalı'}\n` +
        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Kazanana DM** › ${settings.dm_winner ? 'Açık' : 'Kapalı'}\n` +
        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Katılanlar Butonu** › ${settings.show_parts ? 'Açık' : 'Kapalı'}\n` +
        `<:mono:${MONO_EMOJIS.radio || '1537767917666443346'}> **Engelli Roller** › ${settings.ignored_roles.length > 0 ? settings.ignored_roles.map(r => `<@&${r}>`).join(', ') : 'kapalı'}`
    ));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Şu anda ${activeCount} aktif çekiliş var.`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_new').setLabel('Yeni Çekiliş').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.plus || '1530917512333787166'),
        new ButtonBuilder().setCustomId('gw_list').setLabel('Çekilişler').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.search || '1537768093978206240')
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_settings').setLabel('Ayarlar').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.settings || '1530917467650523176')
    );
    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);

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
        for (const userId of participants) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(gw.required_role_id)) {
                eligible.push(userId);
            }
        }
        participants = eligible;
    }

    const count = customWinnerCount || gw.winner_count || 1;
    const winners = [];

    // Rastgele kazanan belirleme (Fisher-Yates)
    const pool = [...participants];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (let i = 0; i < Math.min(count, pool.length); i++) {
        winners.push(pool[i]);
    }

    logGiveaway('end_winners_selected', { messageId, totalParticipants: participants.length, winners });

    // Veritabanını güncelle
    await db.setGiveawayWinners(messageId, winners);

    const settings = await db.getGiveawaySettings(gw.guild_id);

    // Çekiliş Mesajını Güncelle
    try {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
            const payload = buildGiveawayPayload(gw, true, winners, settings.show_parts);
            await msg.edit(payload).catch((e) => logGiveaway('end_msg_edit_failed', { messageId, error: e.message }));
            logGiveaway('end_msg_updated', { messageId });
        } else {
            logGiveaway('end_msg_not_found', { messageId });
        }
    } catch (e) {
        logGiveaway('end_msg_update_error', { messageId, error: e.message });
    }

    // Kazanan Anons Mesajı Gönder
    if (winners.length > 0) {
        const winnerPings = winners.map(w => `<@${w}>`).join(' ');
        
        const announceContainer = new ContainerBuilder();
        
        const descText = `<:mono:${MONO_EMOJIS.gift || '1530917482435579974'}> **${gw.prize}**\n\nÇEKİLİŞ SONUCU\n\n${winnerPings} kazandı!\n<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Düzenleyen ›** <@${gw.host_id}>`;
        announceContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(descText));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Çekilişe Git')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`)
                .setEmoji(MONO_EMOJIS.external_link || '1537769989669658644')
        );
        announceContainer.addActionRowComponents(row);

        const pingContent = settings.ping_role_id ? `<@&${settings.ping_role_id}> ${winnerPings}` : winnerPings;

        await channel.send({ 
            content: pingContent, 
            flags: MessageFlags.IsComponentsV2, 
            components: [announceContainer] 
        }).catch((e) => logGiveaway('end_announce_send_failed', { messageId, error: e.message }));
        logGiveaway('end_announce_sent', { messageId });

        // DM to winners
        if (settings.dm_winner) {
            for (const wid of winners) {
                try {
                    const wmember = await guild.members.fetch(wid);
                    if (wmember) {
                        const dmMsg = createContainerMessage(
                            `<:mono:${MONO_EMOJIS.gift || '1530917482435579974'}> Çekilişi Kazandınız!`,
                            `Tebrikler! **${guild.name}** sunucusundaki **${gw.prize}** çekilişini kazandınız.\nÖdülünüz için <@${gw.host_id}> ile iletişime geçebilirsiniz.`,
                            '#57F287', [], [], false
                        );
                        dmMsg.components[0].addActionRowComponents(
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setLabel('Çekilişe Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`).setEmoji(MONO_EMOJIS.external_link || '1537769989669658644')
                            )
                        );
                        await wmember.send(dmMsg).catch((e) => logGiveaway('end_dm_send_failed', { messageId, winner: wid, error: e.message }));
                        logGiveaway('end_dm_sent', { messageId, winner: wid });
                    }
                } catch(e){
                    logGiveaway('end_dm_error', { messageId, winner: wid, error: e.message });
                }
            }
        }
    } else {
        const noWinnerMsg = createContainerMessage(
            `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Çekiliş Sona Erdi`,
            `**${gw.prize}** çekilişine yeterli katılım olmadığı için kazanan belirlenemedi.`,
            '#ED4245', [], [], false
        );
        noWinnerMsg.components[0].addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Çekilişe Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`)
            )
        );
        await channel.send(noWinnerMsg).catch((e) => logGiveaway('end_no_winner_send_failed', { messageId, error: e.message }));
    }

    logGiveaway('end_complete', { messageId, winnerCount: winners.length });
    return { success: true, winners };
}

function initGiveawayScheduler(client) {
    setInterval(async () => {
        try {
            const activeList = await db.getActiveGiveaways().catch(() => []);
            const now = Date.now();

            for (const gw of activeList) {
                if (now >= gw.ends_at) {
                    logGiveaway('scheduler_ending', { messageId: gw.message_id, endsAt: gw.ends_at });
                    await endGiveaway(gw.message_id, client).catch((e) => logGiveaway('scheduler_end_error', { messageId: gw.message_id, error: e.message }));
                }
            }
            if (activeList.length > 0) logGiveaway('scheduler_tick', { activeCount: activeList.length, now });
        } catch (e) {
            logGiveaway('scheduler_error', { error: e.message });
            console.error('[Giveaway Scheduler Error]:', e);
        }
    }, 10000); // 10 saniyede bir kontrol et
}

async function handleGiveawayButton(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('gw_')) return false;

    // --- MODAL SUBMITS ---
    if (interaction.isModalSubmit()) {
        const { MessageFlags } = require('discord.js');
        if (customId === 'gw_modal_start') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const prize = interaction.fields.getTextInputValue('prize');
            const durationStr = interaction.fields.getTextInputValue('duration').toLowerCase().trim();
            const winnerCountStr = interaction.fields.getTextInputValue('winner_count') || '1';
            let channelInputStr = '';
            try { channelInputStr = interaction.fields.getTextInputValue('channel_id'); } catch(e){}
            let description = '';
            try { description = interaction.fields.getTextInputValue('description'); } catch(e){}

            const winnerCount = parseInt(winnerCountStr, 10) || 1;
            logGiveaway('start_modal', { userId: interaction.user.id, prize, durationStr, winnerCount, channelInputStr });

            let durationMs = 0;
            const regex = /(\d+)\s*(g|d|sa|s|dk|m|h|w)/g;
            let match;
            while ((match = regex.exec(durationStr)) !== null) {
                const val = parseInt(match[1]);
                const unit = match[2];
                if (unit === 'g' || unit === 'd') durationMs += val * 24 * 60 * 60 * 1000;
                else if (unit === 'sa' || unit === 's' || unit === 'h') durationMs += val * 60 * 60 * 1000;
                else if (unit === 'dk' || unit === 'm') durationMs += val * 60 * 1000;
                else if (unit === 'w') durationMs += val * 7 * 24 * 60 * 60 * 1000;
            }

            if (durationMs < 5000) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Geçersiz Süre`,
                    'Lütfen geçerli bir süre girin. Örn: `1g`, `6sa`, `30dk`, `1d`',
                    '#ED4245', [], [], false
                ));
            }

            // Çekiliş kanalını bul
            let targetChannel = interaction.channel;
            if (channelInputStr) {
                const chIdMatch = channelInputStr.match(/\d+/);
                if (chIdMatch) {
                    const ch = interaction.guild.channels.cache.get(chIdMatch[0]);
                    if (ch) targetChannel = ch;
                }
            }

            const endsAt = Date.now() + durationMs;
            const dummyGw = {
                prize,
                description: description || '',
                winner_count: winnerCount,
                required_role_id: null,
                host_id: interaction.user.id,
                ends_at: endsAt,
                status: 'active',
                participants: [],
                message_id: 'dummy' // needed by payload builder if used
            };

            const settings = await db.getGiveawaySettings(interaction.guild.id);
            const payload = buildGiveawayPayload(dummyGw, false, [], settings.show_parts);
            const sentMsg = await targetChannel.send(payload).catch((e) => {
                logGiveaway('start_send_failed', { prize, channelId: targetChannel.id, error: e.message, errorStack: e.stack ? e.stack.split('\n')[1] : null });
                console.error('[Giveaway send hatasi]:', e);
                return null;
            });

            if (!sentMsg) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Gönderim Hatası`,
                    'Çekiliş mesajı belirtilen kanala gönderilemedi. Kanal izinlerimi kontrol edin.',
                    '#ED4245', [], [], false
                ));
            }

            await db.createGiveaway({
                message_id: sentMsg.id,
                channel_id: targetChannel.id,
                guild_id: interaction.guild.id,
                prize,
                description: description || '',
                winner_count: winnerCount,
                required_role_id: null,
                host_id: interaction.user.id,
                ends_at: endsAt
            });

            const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id }, false, [], settings.show_parts);
            await sentMsg.edit(finalPayload).catch((e) => logGiveaway('start_edit_failed', { messageId: sentMsg.id, error: e.message }));
            logGiveaway('start_complete', { messageId: sentMsg.id, prize, channelId: targetChannel.id, endsAt });

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Başlatıldı!`,
                `Çekiliş başarıyla <#${targetChannel.id}> kanalında başlatıldı.`,
                '#57F287', [], [], false
            ));
        }

        if (customId === 'gw_modal_end') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const messageId = interaction.fields.getTextInputValue('msg_id').trim();
            const res = await endGiveaway(messageId, interaction.client);
            if (res.error) {
                return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> İşlem Başarısız`, res.error, '#ED4245', [], [], false));
            }
            return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Sonlandırıldı`, `Çekiliş başarıyla bitirildi.`, '#57F287', [], [], false));
        }

        if (customId === 'gw_modal_reroll') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const messageId = interaction.fields.getTextInputValue('msg_id').trim();
            const countStr = interaction.fields.getTextInputValue('winner_count') || '1';
            const count = parseInt(countStr, 10) || 1;
            const res = await endGiveaway(messageId, interaction.client, true, count);
            if (res.error) {
                return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> İşlem Başarısız`, res.error, '#ED4245', [], [], false));
            }
            return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Yeniden Çekildi (Reroll)`, `Yeni kazananlar başarıyla belirlendi.`, '#57F287', [], [], false));
        }

        if (customId === 'gw_modal_settings') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const data = { manager_roles: [], log_channel_id: null, ping_role_id: null, ignored_roles: [], dm_winner: true, show_parts: true };
            try {
                data.manager_roles = interaction.fields.getTextInputValue('yetkili_rolleri').split(',').map(s => s.trim()).filter(Boolean);
            } catch(e){}
            try {
                const v = interaction.fields.getTextInputValue('log_kanali').trim();
                data.log_channel_id = v || null;
            } catch(e){}
            try {
                const v = interaction.fields.getTextInputValue('duyuru_rolu').trim();
                data.ping_role_id = v || null;
            } catch(e){}
            try {
                data.ignored_roles = interaction.fields.getTextInputValue('engelli_roller').split(',').map(s => s.trim()).filter(Boolean);
            } catch(e){}
            const secenek = interaction.fields.getTextInputValue('secenekler').toLowerCase();
            data.dm_winner = !secenek.includes('dm:kapalı') && !secenek.includes('dm:kapali');
            data.show_parts = !secenek.includes('katilanlar:kapalı') && !secenek.includes('katilanlar:kapali');
            await db.setGiveawaySettings(interaction.guild.id, data);
            logGiveaway('settings_saved', { guildId: interaction.guild.id, data });
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Ayarlar Kaydedildi`,
                `Çekiliş ayarları güncellendi. Yeni çekilişlerde geçerli olacak.`,
                '#57F287', [], [], false
            ));
        }
        return true;
    }

    if (interaction.isStringSelectMenu()) {
        const { MessageFlags } = require('discord.js');
        if (customId === 'gw_manage_select') {
            await interaction.deferUpdate();
            const messageId = interaction.values[0];
            logGiveaway('manage_select', { messageId, userId: interaction.user.id });
            const gw = await db.getGiveaway(messageId);
            
            if (!gw) {
                logGiveaway('manage_select_gw_missing', { messageId });
                return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata`, 'Çekiliş bulunamadı.', '#ED4245', [], [], false));
            }

            const payload = buildManageGiveawayPayload(gw);
            await interaction.editReply(payload);
            return true;
        }
    }

    // --- BUTTONS ---
    const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const [action, messageId] = customId.split(':');
    const userId = interaction.user.id;

    if (action === 'gw_new') {
        const modal = new ModalBuilder().setCustomId('gw_modal_start').setTitle('Yeni Çekiliş');
        
        const prizeInput = new TextInputBuilder().setCustomId('prize').setLabel('Ödül *').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ne çekiliyor? Kartın başlığında bu yazacak.');
        const durationInput = new TextInputBuilder().setCustomId('duration').setLabel('Süre *').setStyle(TextInputStyle.Short).setRequired(true).setValue('1d').setPlaceholder('Örnek: 1g, 6sa, 30dk, 1sa30dk');
        const countInput = new TextInputBuilder().setCustomId('winner_count').setLabel('Kazanan sayısı *').setStyle(TextInputStyle.Short).setRequired(true).setValue('1').setPlaceholder('1 ile 20 arası.');
        const channelInput = new TextInputBuilder().setCustomId('channel_id').setLabel('Çekiliş kanalı *').setStyle(TextInputStyle.Short).setRequired(true).setValue(interaction.channel.id).setPlaceholder('Kanal ID veya etiket');
        const descInput = new TextInputBuilder().setCustomId('description').setLabel('Açıklama').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('İsteğe bağlı. Ödülün detayı, kurallar vb.');
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(prizeInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(countInput),
            new ActionRowBuilder().addComponents(channelInput),
            new ActionRowBuilder().addComponents(descInput)
        );
        await interaction.showModal(modal);
        return true;
    }

    if (action === 'gw_settings') {
        logGiveaway('settings_modal_open', { userId });
        const settings = await db.getGiveawaySettings(interaction.guild.id);

        const modal = new ModalBuilder().setCustomId('gw_modal_settings').setTitle('Çekiliş Ayarları');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yetkili_rolleri').setLabel('Yetkili Rolleri (virgülle ayır, boş bırakabilirsin)').setStyle(TextInputStyle.Short).setRequired(false).setValue(settings.manager_roles.join(', ')).setPlaceholder('Örn: 111111111111111111, 222222222222222222')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('log_kanali').setLabel('Log Kanalı ID (boş = kapalı)').setStyle(TextInputStyle.Short).setRequired(false).setValue(settings.log_channel_id || '').setPlaceholder('Örn: 333333333333333333')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duyuru_rolu').setLabel('Duyuru Rolü ID (boş = kapalı)').setStyle(TextInputStyle.Short).setRequired(false).setValue(settings.ping_role_id || '').setPlaceholder('Örn: 444444444444444444')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('engelli_roller').setLabel('Katılamayacak Roller (virgülle ayır)').setStyle(TextInputStyle.Short).setRequired(false).setValue(settings.ignored_roles.join(', ')).setPlaceholder('Örn: 555555555555555555')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('secenekler').setLabel('Seçenekler (dm / katilanlar)').setStyle(TextInputStyle.Short).setRequired(true).setValue(`dm:${settings.dm_winner ? 'açık' : 'kapalı'}, katilanlar:${settings.show_parts ? 'açık' : 'kapalı'}`).setPlaceholder('dm:açık, katilanlar:açık'))
        );
        await interaction.showModal(modal);
        return true;
    }

    if (action === 'gw_forceend') {
        await interaction.deferUpdate();
        logGiveaway('forceend_start', { messageId, userId });
        try {
            await endGiveaway(messageId, interaction.client);
            const gw = await db.getGiveaway(messageId);
            if (gw) {
                const payload = buildManageGiveawayPayload(gw);
                await interaction.editReply(payload);
            }
        } catch (e) {
            logGiveaway('forceend_error', { messageId, error: e.message });
        }
        return true;
    }

    if (action === 'gw_parts_toggle') {
        await interaction.deferUpdate();
        const gw = await db.getGiveaway(messageId);
        if (gw) {
            const newVal = gw.show_parts === false ? true : false;
            logGiveaway('parts_toggle', { messageId, userId, from: gw.show_parts, to: newVal });
            await db.setShowParts(messageId, newVal);
            const updatedGw = await db.getGiveaway(messageId);
            const payload = buildManageGiveawayPayload(updatedGw);
            await interaction.editReply(payload);

            // update the main message too if active
            if (updatedGw.status === 'active') {
                const channel = interaction.client.channels.cache.get(updatedGw.channel_id);
                if (channel) {
                    const msg = await channel.messages.fetch(messageId).catch(() => null);
                    if (msg) {
                        const mainPayload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
                        await msg.edit(mainPayload).catch((e) => logGiveaway('parts_toggle_msg_edit_failed', { messageId, error: e.message }));
                    } else {
                        logGiveaway('parts_toggle_msg_not_found', { messageId });
                    }
                } else {
                    logGiveaway('parts_toggle_channel_missing', { messageId, channelId: updatedGw.channel_id });
                }
            }
        } else {
            logGiveaway('parts_toggle_gw_missing', { messageId });
        }
        return true;
    }

    if (action === 'gw_cancel') {
        await interaction.deferUpdate();
        logGiveaway('cancel_start', { messageId, userId });
        const gw = await db.getGiveaway(messageId);
        if (gw) {
            await db.cancelGiveaway(messageId);
            logGiveaway('cancel_db_updated', { messageId, status: 'cancelled' });

            const channel = interaction.client.channels.cache.get(gw.channel_id);
            if (channel) {
                const msg = await channel.messages.fetch(messageId).catch((e) => {
                    logGiveaway('cancel_msg_fetch_failed', { messageId, error: e.message });
                    return null;
                });
                if (msg) {
const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Çekiliş Ayarları**\n\nBu form Muawh uygulamasına gönderilecek. Şifrelerini ya da diğer hassas bilgilerini paylaşmadığından emin ol.`));
                    await msg.edit({ flags: MessageFlags.IsComponentsV2, components: [container] }).catch((e) => logGiveaway('cancel_msg_edit_failed', { messageId, error: e.message }));
                }
            } else {
                logGiveaway('cancel_channel_missing', { messageId, channelId: gw.channel_id });
            }

            const payload = buildManageGiveawayPayload(gw);
            await interaction.editReply(payload);
        } else {
            logGiveaway('cancel_gw_missing', { messageId });
        }
        return true;
    }

    if (action === 'gw_list') {
        await interaction.deferUpdate();
        logGiveaway('list_open', { guildId: interaction.guild.id, userId });
        const payload = await buildGiveawayListPayload(interaction.guild.id);
        await interaction.editReply(payload);
        return true;
    }

    if (action === 'gw_home') {
        await interaction.deferUpdate();
        logGiveaway('home_back', { guildId: interaction.guild.id, userId });
        const payload = await buildMainPanelPayload(interaction.guild.id);
        await interaction.editReply(payload);
        return true;
    }

    if (action === 'gw_join') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gw = await db.getGiveaway(messageId);
        if (!gw || gw.status !== 'active') {
            logGiveaway('join_not_active', { messageId, userId });
            return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Çekiliş Aktif Değil`, 'Bu çekiliş sona ermiş.', '#ED4245', [], [], false));
        }
        if (gw.required_role_id && !interaction.member.roles.cache.has(gw.required_role_id)) {
            return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Rol Şartı`, `Katılmak için <@&${gw.required_role_id}> rolü gerekli!`, '#ED4245', [], [], false));
        }
        const res = await db.toggleGiveawayParticipant(messageId, userId);
        if (!res) {
            logGiveaway('join_db_failed', { messageId, userId });
            return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata`, 'Katılım işlenemedi.', '#ED4245', [], [], false));
        }
        logGiveaway('join_toggled', { messageId, userId, joined: res.joined, count: res.count });
        try {
            const updatedGw = await db.getGiveaway(messageId);
            const payload = buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts);
            await interaction.message.edit(payload).catch((e) => logGiveaway('join_msg_edit_failed', { messageId, error: e.message }));
        } catch (e) {
            logGiveaway('join_msg_edit_error', { messageId, error: e.message });
        }
        if (res.joined) return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Katıldınız!`, `**${gw.prize}** çekilişine dahil oldunuz.`, '#57F287', [], [], false));
        else return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Ayrıldınız`, `Çekilişten ayrıldınız.`, '#ED4245', [], [], false));
    }

    if (action === 'gw_parts') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gw = await db.getGiveaway(messageId);
        if (!gw) return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`, 'Çekiliş bulunamadı.', '#ED4245', [], [], false));
        const parts = gw.participants || [];
        const partsText = parts.length > 0 ? parts.slice(0, 30).map((p, idx) => `${idx + 1}. <@${p}>`).join('\n') + (parts.length > 30 ? `\n*...ve ${parts.length - 30} kişi daha*` : '') : '*Henüz katılımcı yok.*';
        return interaction.editReply(createContainerMessage(`<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Katılımcılar (${parts.length})`, `**${gw.prize}** çekilişine katılanlar:`, '#5865F2', [], [{ name: 'Katılımcı Listesi', value: partsText, inline: false }], false));
    }

    return true;

}

module.exports = {
    buildGiveawayPayload,
    buildManageGiveawayPayload,
    buildGiveawayListPayload,
    buildMainPanelPayload,
    endGiveaway,
    initGiveawayScheduler,
    handleGiveawayButton
};
