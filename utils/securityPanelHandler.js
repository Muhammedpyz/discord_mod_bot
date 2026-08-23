'use strict';

const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ButtonBuilder, ButtonStyle, ActionRowBuilder,
    RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags, ActivityType
} = require('discord.js');

const {
    pool, getVanityConfig, setVanityConfig,
    addVanityUser, removeVanityUser, getVanityUsers
} = require('../db');
const { createContainerMessage, COLORS, MONO_EMOJIS } = require('./uiBuilder');

// ============================================================
// DURUMDA VANITY METNİ ARAMA (HAS VANITY)
// ============================================================
function hasVanity(memberOrPresence, vanityString) {
    if (!memberOrPresence || !vanityString) return false;
    const needle = vanityString.toLowerCase().trim();
    if (!needle) return false;

    const activities = memberOrPresence.activities || [];
    for (const act of activities) {
        if (act.type === ActivityType.Custom || act.name === 'Custom Status') {
            const text = `${act.name || ''} ${act.state || ''} ${act.details || ''}`.toLowerCase();
            if (text.includes(needle)) return true;
        }
    }
    return false;
}

// ============================================================
// VANITY ROLÜ VERME & BİLDİRİM GÖNDERME (APPLY VANITY)
// ============================================================
async function applyVanity(guild, member, config, client) {
    if (!guild || !member || member.user?.bot || !config || !config.is_enabled || !config.vanity_string) return false;

    const roles = config.roles || (config.role_id ? [config.role_id] : []);
    if (!roles || roles.length === 0) return false;

    const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    const botTopPos = me?.roles?.highest?.position || 0;

    const rolesToAdd = roles
        .map(id => guild.roles.cache.get(id))
        .filter(r => r && !member.roles.cache.has(r.id) && r.position < botTopPos);

    if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd, `[Vanity] Durumuna "${config.vanity_string}" ekledi.`).catch(err => {
            console.error(`[Vanity] Rol verme hatası (${member.id}):`, err.message);
        });
    }

    // DB'ye kaydet ve ilk kez mi ekledi kontrol et
    const isNewAdopter = await addVanityUser(guild.id, member.id);

    // Bildirim Mesajı (Sadece ilk kez eklediyse veya daha önce duyurulmadıysa)
    if (isNewAdopter && config.channel_id) {
        const channel = guild.channels.cache.get(config.channel_id);
        if (channel) {
            const defaultMsg = `{user.mention} durumuna **{vanity}** ekleyerek özel durum rolü kazandı! Teşekkürler! 🎉`;
            const rawMsg = config.message || defaultMsg;
            const formatted = rawMsg
                .replace(/\{user\.mention\}|\{user\}/g, `<@${member.id}>`)
                .replace(/\{user\.name\}|\{username\}/g, member.user.username)
                .replace(/\{user\.id\}/g, member.id)
                .replace(/\{server\.name\}|\{server\}/g, guild.name)
                .replace(/\{vanity\}/g, config.vanity_string);

            const payload = createContainerMessage(
                'Özel Durum Rolü Kazanıldı!',
                formatted,
                COLORS.SUCCESS || '#57F287'
            );
            await channel.send(payload).catch(err => {
                console.error(`[Vanity] Kanal bildirim hatası:`, err.message);
            });
        }
    }
    return true;
}

// ============================================================
// VANITY ROLÜNÜ ALMA (REMOVE VANITY)
// ============================================================
async function removeVanity(guild, member, config, client) {
    if (!guild || !member || member.user?.bot || !config) return false;

    const roles = config.roles || (config.role_id ? [config.role_id] : []);
    if (!roles || roles.length === 0) return false;

    const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    const botTopPos = me?.roles?.highest?.position || 0;

    const rolesToRemove = roles
        .map(id => guild.roles.cache.get(id))
        .filter(r => r && member.roles.cache.has(r.id) && r.position < botTopPos);

    if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove, `[Vanity] Durumundan "${config.vanity_string}" kaldırıldı.`).catch(err => {
            console.error(`[Vanity] Rol alma hatası (${member.id}):`, err.message);
        });
    }

    await removeVanityUser(guild.id, member.id);
    return true;
}

// ============================================================
// TÜM SUNUCUYU TARAMA (RUN VANITY SCAN)
// ============================================================
async function runVanityScan(guild, client) {
    const cfg = (await getVanityConfig(guild.id).catch(() => null)) || {};
    if (!cfg.is_enabled || !cfg.vanity_string) return { granted: 0, removed: 0, total: 0 };

    const roles = cfg.roles || (cfg.role_id ? [cfg.role_id] : []);
    if (!roles || roles.length === 0) return { granted: 0, removed: 0, total: 0 };

    await guild.members.fetch().catch(() => {});

    console.log(`[Vanity Scan] ${guild.name} sunucusunda tarama başladı (Aranan: "${cfg.vanity_string}")`);

    let granted = 0;
    let removed = 0;
    let total = 0;

    for (const member of guild.members.cache.values()) {
        if (member.user.bot) continue;

        const presence = guild.presences.cache.get(member.id) || member.presence;
        const matches = hasVanity(presence, cfg.vanity_string);

        const hasAnyRole = roles.some(rid => member.roles.cache.has(rid));

        if (matches) {
            total++;
            if (!hasAnyRole) {
                await applyVanity(guild, member, cfg, client);
                granted++;
            } else {
                await addVanityUser(guild.id, member.id);
            }
        } else if (!matches && hasAnyRole) {
            await removeVanity(guild, member, cfg, client);
            removed++;
        }
    }

    console.log(`[Vanity Scan] Tamamlandı: ${granted} verildi, ${removed} alındı, toplam ${total} üye.`);
    return { granted, removed, total };
}

// ============================================================
// VANITY YÖNETİM PANELİ (COMPONENTS V2)
// ============================================================
async function buildVanityPanel(guild, note = '') {
    const cfg = (await getVanityConfig(guild.id).catch(() => null)) || {};
    const isEnabled = Boolean(cfg.is_enabled);

    const roles = cfg.roles || (cfg.role_id ? [cfg.role_id] : []);
    const validRoles = roles.map(rid => guild.roles.cache.get(rid)).filter(Boolean);

    const rolesText = validRoles.length > 0
        ? validRoles.map(r => `<@&${r.id}>`).join(', ')
        : '`Rol Ayarlanmadı`';

    const channel = cfg.channel_id ? guild.channels.cache.get(cfg.channel_id) : null;
    const channelText = channel ? `<#${channel.id}>` : '`Ayarlanmadı (Sessiz Mod)`';

    const messageText = cfg.message
        ? `\`${cfg.message.length > 100 ? cfg.message.slice(0, 97) + '...' : cfg.message}\``
        : '`Varsayılan Tebrik Mesajı`';

    const trackedUsers = await getVanityUsers(guild.id).catch(() => []);
    const activeCount = trackedUsers.length;

    const isReady = Boolean(cfg.vanity_string) && validRoles.length > 0;
    const statusEmoji = isEnabled
        ? `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}>`
        : `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}>`;

    const desc = [
        `**Sistem Durumu:** ${statusEmoji} ${isEnabled ? '**Aktif**' : '**Kapalı**'}`,
        `**Aranan Özel Durum:** ${cfg.vanity_string ? `\`${cfg.vanity_string}\`` : '`Ayarlanmadı`'}`,
        `**Verilecek Roller:** ${rolesText} (${validRoles.length} Adet)`,
        `**Duyuru Kanalı:** ${channelText}`,
        `**Özel Mesaj:** ${messageText}`,
        `**Aktif Taşıyan Üye:** \`${activeCount} Kişi\``,
        ``,
        `*Üyeler Discord özel durumlarına (Custom Status) belirlenen yazıyı eklediğinde anında rolleri verilir, çıkardıklarında otomatik geri alınır.*`
    ].join('\n');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sec_va_text_btn')
            .setLabel('Yazı Ayarla')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.pen_tool || '1537767814214189086'),
        new ButtonBuilder()
            .setCustomId('sec_va_roles_btn')
            .setLabel('Rolleri Ayarla')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.medal || '1537767798472704032'),
        new ButtonBuilder()
            .setCustomId('sec_va_channel_btn')
            .setLabel('Duyuru Kanalı')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.announcement || '1530917526391750676'),
        new ButtonBuilder()
            .setCustomId('sec_va_msg_btn')
            .setLabel('Mesajı Ayarla')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.message_circle || '1537768113221799957')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sec_va_toggle_btn')
            .setLabel(isEnabled ? 'Sistemi Kapat' : 'Sistemi Aç')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!isReady && !isEnabled)
            .setEmoji(isEnabled ? (MONO_EMOJIS.lock || '1530918940065267712') : (MONO_EMOJIS.unlock || '1530918955726667867')),
        new ButtonBuilder()
            .setCustomId('sec_va_scan_btn')
            .setLabel('Şimdi Tara')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!isReady)
            .setEmoji(MONO_EMOJIS.refresh_cw || '1537768206989791232'),
        new ButtonBuilder()
            .setCustomId('sec_va_list_btn')
            .setLabel('Taşıyanlar Listesi')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.list || '1537768217316040735'),
        new ButtonBuilder()
            .setCustomId('sec_va_reset_btn')
            .setLabel('Sıfırla')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.rotate_ccw || '1537768179000938526')
    );

    const finalDesc = note ? `${desc}\n\n<:mono:${MONO_EMOJIS.info || '1537770160021049345'}> **${note}**` : desc;

    return createContainerMessage(
        'Vanity (Özel Durum Rolü) Yönetim Paneli',
        finalDesc,
        COLORS.PRIMARY || '#5865F2',
        [row1, row2]
    );
}

// ============================================================
// VANITY ETKİLEŞİM İŞLEYİCİSİ (INTERACTION HANDLER)
// ============================================================
async function handleSecurityPanelInteraction(interaction, client) {
    if (!interaction.customId.startsWith('sec_va_')) return false;

    const customId = interaction.customId;
    const guildId = interaction.guild.id;

    // 1. YAZI AYARLA (MODAL GÖSTER)
    if (customId === 'sec_va_text_btn') {
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        const modal = new ModalBuilder()
            .setCustomId('sec_va_text_modal')
            .setTitle('Özel Durum Yazısını Belirleyin');

        const input = new TextInputBuilder()
            .setCustomId('vanity_text_input')
            .setLabel('Durumda Aranacak Metin / Link')
            .setPlaceholder('Örn: .gg/turklion veya turklion.net')
            .setValue(cfg.vanity_string || '')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(60)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal).catch(err => console.error('[Vanity Modal Error]:', err));
        return true;
    }

    // 1.1 YAZI MODAL SUBMIT
    if (customId === 'sec_va_text_modal') {
        await interaction.deferUpdate().catch(() => {});
        const text = interaction.fields.getTextInputValue('vanity_text_input').trim();
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};

        let note = '';
        if (text) {
            await setVanityConfig(guildId, text, cfg.roles || cfg.role_id, cfg.channel_id, Boolean(cfg.is_enabled), cfg.message);
            if (cfg.is_enabled) {
                const { granted, removed, total } = await runVanityScan(interaction.guild, client);
                note = `Yazı güncellendi (\`${text}\`). Tarama yapıldı: **${granted}** üyeye rol verildi, **${removed}** üyeden alındı (Toplam: **${total}** üye).`;
            } else {
                note = `Aranan özel durum yazısı \`${text}\` olarak kaydedildi.`;
            }
        }

        const panel = await buildVanityPanel(interaction.guild, note);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 2. ROLLERİ AYARLA (ROLE SELECT MENU GÖSTER)
    if (customId === 'sec_va_roles_btn') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        const currentRoles = cfg.roles || (cfg.role_id ? [cfg.role_id] : []);

        const select = new RoleSelectMenuBuilder()
            .setCustomId('sec_va_roles_select')
            .setPlaceholder('Verilecek rol veya rolleri seçin')
            .setMinValues(1)
            .setMaxValues(10);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('sec_va_back_btn')
            .setLabel('Geri / İptal')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161');

        const container = createContainerMessage(
            'Özel Durum Rollerini Seçin',
            `Durumuna sunucu yazısını ekleyen üyelere verilecek rolleri aşağıdaki menüden seçin.\nBirden fazla rol seçebilirsiniz (En fazla 10 adet).\n\n` +
            `*Şu an tanımlı:* ${currentRoles.length > 0 ? currentRoles.map(r => `<@&${r}>`).join(', ') : '`Yok`'}`,
            COLORS.PRIMARY || '#5865F2',
            [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(cancelBtn)]
        );

        container.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(container);
        return true;
    }

    // 2.1 ROLLER SEÇİLDİĞİNDE
    if (customId === 'sec_va_roles_select') {
        await interaction.deferUpdate().catch(() => {});
        const selectedRoleIds = interaction.values || [];
        const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
        const botTopPos = me?.roles?.highest?.position || 0;

        const invalidRoles = selectedRoleIds
            .map(id => interaction.guild.roles.cache.get(id))
            .filter(r => r && r.position >= botTopPos);

        if (invalidRoles.length > 0) {
            const err = createContainerMessage(
                'Rol Sıralaması Yetersiz',
                `Şu roller botun en yüksek rolünden üstte olduğu için verilemez:\n` +
                invalidRoles.map(r => `> • <@&${r.id}>`).join('\n') +
                `\n\nLütfen botun rolünü sunucu ayarlarından bu rollerin üzerine taşıyın veya daha düşük roller seçin.`,
                COLORS.ERROR || '#ED4245',
                [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sec_va_roles_btn').setLabel('Tekrar Seç').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('sec_va_back_btn').setLabel('Geri').setStyle(ButtonStyle.Secondary)
                )]
            );
            err.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.editReply(err);
            return true;
        }

        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        await setVanityConfig(guildId, cfg.vanity_string || null, selectedRoleIds, cfg.channel_id, Boolean(cfg.is_enabled), cfg.message);

        let note = `**${selectedRoleIds.length}** adet ödül rolü başarıyla kaydedildi.`;
        if (cfg.is_enabled && cfg.vanity_string) {
            const { granted, removed, total } = await runVanityScan(interaction.guild, client);
            note += ` Tarama yapıldı: **${granted}** üyeye rol verildi, **${removed}** üyeden alındı.`;
        }

        const panel = await buildVanityPanel(interaction.guild, note);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 3. DUYURU KANALI AYARLA
    if (customId === 'sec_va_channel_btn') {
        await interaction.deferUpdate().catch(() => {});
        const chanSelect = new ChannelSelectMenuBuilder()
            .setCustomId('sec_va_channel_select')
            .setPlaceholder('Duyuru kanalını seçin')
            .setChannelTypes(ChannelType.GuildText);

        const removeChanBtn = new ButtonBuilder()
            .setCustomId('sec_va_channel_remove')
            .setLabel('Kanalı Kaldır (Sessiz Mod)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.delete || '1530918957349867711');

        const backBtn = new ButtonBuilder()
            .setCustomId('sec_va_back_btn')
            .setLabel('Geri')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161');

        const container = createContainerMessage(
            'Duyuru / Kutlama Kanalı',
            'Bir üye durumuna sunucu yazısını eklediğinde tebrik mesajının gönderileceği kanalı belirleyin:',
            COLORS.PRIMARY || '#5865F2',
            [new ActionRowBuilder().addComponents(chanSelect), new ActionRowBuilder().addComponents(removeChanBtn, backBtn)]
        );

        container.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(container);
        return true;
    }

    // 3.1 KANAL SEÇİLDİ
    if (customId === 'sec_va_channel_select') {
        await interaction.deferUpdate().catch(() => {});
        const channelId = interaction.values[0];
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        await setVanityConfig(guildId, cfg.vanity_string || null, cfg.roles || cfg.role_id, channelId, Boolean(cfg.is_enabled), cfg.message);

        const panel = await buildVanityPanel(interaction.guild, `Duyuru kanalı <#${channelId}> olarak ayarlandı.`);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 3.2 KANAL KALDIRILDI
    if (customId === 'sec_va_channel_remove') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        await setVanityConfig(guildId, cfg.vanity_string || null, cfg.roles || cfg.role_id, null, Boolean(cfg.is_enabled), cfg.message);

        const panel = await buildVanityPanel(interaction.guild, `Duyuru kanalı kaldırıldı (Sessiz moda geçildi).`);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 4. KUTLAMA MESAJINI AYARLA (MODAL)
    if (customId === 'sec_va_msg_btn') {
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        const modal = new ModalBuilder()
            .setCustomId('sec_va_msg_modal')
            .setTitle('Kutlama / Tebrik Mesajı');

        const input = new TextInputBuilder()
            .setCustomId('vanity_msg_input')
            .setLabel('Kutlama Mesajı')
            .setPlaceholder('Örn: {user.mention} durumuna {vanity} ekledi, teşekkürler!')
            .setValue(cfg.message || '')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal).catch(err => console.error('[Vanity Msg Modal Error]:', err));
        return true;
    }

    // 4.1 MESAJ MODAL SUBMIT
    if (customId === 'sec_va_msg_modal') {
        await interaction.deferUpdate().catch(() => {});
        const msg = interaction.fields.getTextInputValue('vanity_msg_input').trim();
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};

        await setVanityConfig(guildId, cfg.vanity_string || null, cfg.roles || cfg.role_id, cfg.channel_id, Boolean(cfg.is_enabled), msg || null);

        const panel = await buildVanityPanel(interaction.guild, msg ? `Kutlama mesajı güncellendi.` : `Kutlama mesajı varsayılana sıfırlandı.`);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 5. AÇ / KAPAT TOGGLE
    if (customId === 'sec_va_toggle_btn') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = (await getVanityConfig(guildId).catch(() => null)) || {};
        const newState = !Boolean(cfg.is_enabled);

        await setVanityConfig(guildId, cfg.vanity_string || null, cfg.roles || cfg.role_id, cfg.channel_id, newState, cfg.message);

        let note = '';
        if (newState) {
            const { granted, removed, total } = await runVanityScan(interaction.guild, client);
            note = `Sistem **Aktif** edildi. Tüm sunucu tarandı: **${granted}** üyeye rol verildi, **${removed}** üyeden alındı (Toplam: **${total}** üye).`;
        } else {
            note = `Sistem **Devre Dışı** bırakıldı.`;
        }

        const panel = await buildVanityPanel(interaction.guild, note);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 6. ŞİMDİ TARA (MANUAL SCAN)
    if (customId === 'sec_va_scan_btn') {
        await interaction.deferUpdate().catch(() => {});
        const { granted, removed, total } = await runVanityScan(interaction.guild, client);
        const note = `Tarama Tamamlandı: **${granted}** üyeye yeni rol verildi, **${removed}** üyeden rol geri alındı. (Şu an durumu taşıyan: **${total}** üye)`;

        const panel = await buildVanityPanel(interaction.guild, note);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 7. TAŞIYANLARI LİSTELE
    if (customId === 'sec_va_list_btn') {
        await interaction.deferUpdate().catch(() => {});
        const users = await getVanityUsers(guildId).catch(() => []);

        let lines = [];
        if (users.length === 0) {
            lines.push('Henüz durumunda sunucu yazısını taşıyan üye tespit edilmedi.');
        } else {
            for (const row of users.slice(0, 25)) {
                const member = interaction.guild.members.cache.get(row.user_id);
                const timeSec = Math.floor(new Date(row.adopted_at).getTime() / 1000);
                const timeTag = isNaN(timeSec) ? '' : ` • <t:${timeSec}:R>`;
                if (member) {
                    lines.push(`> • <@${member.id}> (\`${member.user.tag}\`)${timeTag}`);
                } else {
                    lines.push(`> • \`${row.user_id}\`${timeTag}`);
                }
            }
        }

        const backBtn = new ButtonBuilder()
            .setCustomId('sec_va_back_btn')
            .setLabel('Geri Dön')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161');

        const container = createContainerMessage(
            `Durumunda Yazı Taşıyanlar (${users.length} Kişi)`,
            lines.join('\n') + (users.length > 25 ? `\n\n*ve ${users.length - 25} üye daha...*` : ''),
            COLORS.PRIMARY || '#5865F2',
            [new ActionRowBuilder().addComponents(backBtn)]
        );

        container.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(container);
        return true;
    }

    // 8. SIFIRLA PANELİ
    if (customId === 'sec_va_reset_btn') {
        await interaction.deferUpdate().catch(() => {});
        const container = createContainerMessage(
            'Vanity Ayarlarını Sıfırla',
            'Vanity yazısı, rolü, duyuru kanalı ve tüm taşıyan üye geçmişi kalıcı olarak silinecektir.\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?',
            COLORS.ERROR || '#ED4245',
            [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sec_va_reset_confirm').setLabel('Evet, Sıfırla').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.check || '1530917534885478600'),
                new ButtonBuilder().setCustomId('sec_va_back_btn').setLabel('İptal').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross || '1530917536806469783')
            )]
        );
        container.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(container);
        return true;
    }

    // 8.1 SIFIRLA ONAY
    if (customId === 'sec_va_reset_confirm') {
        await interaction.deferUpdate().catch(() => {});
        await pool.query('DELETE FROM guild_vanity_config WHERE guild_id = ?', [guildId]).catch(() => {});
        await pool.query('DELETE FROM guild_vanity_users WHERE guild_id = ?', [guildId]).catch(() => {});

        const panel = await buildVanityPanel(interaction.guild, 'Tüm vanity ayarları ve verileri başarıyla sıfırlandı.');
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    // 9. GERİ BUTONU
    if (customId === 'sec_va_back_btn') {
        await interaction.deferUpdate().catch(() => {});
        const panel = await buildVanityPanel(interaction.guild);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    return false;
}

module.exports = {
    hasVanity,
    applyVanity,
    removeVanity,
    runVanityScan,
    buildVanityPanel,
    handleSecurityPanelInteraction
};