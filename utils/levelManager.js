const { 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, MessageFlags 
} = require('discord.js');

const { 
    getLevelConfig, updateLevelConfig, 
    getLevelUser, addLevelUserXP, addLevelUserInvites, 
    setLevelUser, resetLevelUser, resetGuildLevels, 
    getLevelRewards, addLevelReward, removeLevelReward, 
    getTopLevelUsers, getLevelRank 
} = require('../db');

const { createContainerMessage, MONO_EMOJIS, COLORS } = require('./uiBuilder');
const { sendLog } = require('./logger');

// --- LEVEL & XP HESAPLAMA YARDIMCILARI ---

function getXPForNextLevel(currentLevel, xpPerLevel = 100) {
    return Math.max(1, currentLevel) * xpPerLevel;
}

function getTotalXPForLevel(targetLevel, xpPerLevel = 100) {
    let total = 0;
    for (let l = 0; l < targetLevel; l++) {
        total += Math.max(1, l) * xpPerLevel;
    }
    return total;
}

function getLevelFromTotalXP(totalXP, xpPerLevel = 100) {
    let level = 0;
    let accumulated = 0;
    while (true) {
        const needed = Math.max(1, level) * xpPerLevel;
        if (totalXP >= accumulated + needed) {
            accumulated += needed;
            level++;
        } else {
            break;
        }
    }
    const currentProgressXP = totalXP - accumulated;
    const nextLevelRequiredXP = Math.max(1, level) * xpPerLevel;
    return {
        level,
        currentProgressXP,
        nextLevelRequiredXP,
        currentLevelBaseXP: accumulated
    };
}

function createProgressBar(current, total, length = 12) {
    if (total <= 0) total = 1;
    const progress = Math.min(1, Math.max(0, current / total));
    const filled = Math.round(progress * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// --- SEVİYE ATLAMA BİLDİRİMİ & ROL DAĞITIMI ---

async function checkAndApplyLevelUp(client, guild, member, oldXP, newXP, levelCfg, currentChannel = null) {
    const xpPerLevel = levelCfg.xp_per_level || 100;
    const oldStats = getLevelFromTotalXP(oldXP, xpPerLevel);
    const newStats = getLevelFromTotalXP(newXP, xpPerLevel);

    if (newStats.level > oldStats.level) {
        // Seviye güncellendi
        await setLevelUser(guild.id, member.id, newXP, newStats.level).catch(() => {});

        // Rol Ödüllerini Uygula
        const rewards = await getLevelRewards(guild.id).catch(() => []);
        if (rewards && rewards.length > 0 && member.roles) {
            const rewardMode = levelCfg.reward_mode || 'stack';
            
            if (rewardMode === 'single') {
                // Tek Rütbe Modu: Sadece en yüksek hak edilen rolü ver, önceki ödül rollerini al
                const eligibleRewards = rewards.filter(r => r.level <= newStats.level).sort((a, b) => b.level - a.level);
                const highestReward = eligibleRewards[0];
                
                for (const r of rewards) {
                    if (highestReward && r.role_id === highestReward.role_id) {
                        if (!member.roles.cache.has(r.role_id)) {
                            await member.roles.add(r.role_id, `Level Sistemi: ${newStats.level}. Seviye Ödülü`).catch(() => {});
                        }
                    } else {
                        if (member.roles.cache.has(r.role_id)) {
                            await member.roles.remove(r.role_id, `Level Sistemi: Tek rütbe modu (Önceki rütbe temizlendi)`).catch(() => {});
                        }
                    }
                }
            } else {
                // Birikimli Mod: Hak edilen tüm rolleri ver, eskileri tut
                for (const r of rewards) {
                    if (r.level <= newStats.level && !member.roles.cache.has(r.role_id)) {
                        await member.roles.add(r.role_id, `Level Sistemi: ${r.level}. Seviye Ödülü`).catch(() => {});
                    }
                }
            }
        }

        // Bildirimi Gönder
        if (levelCfg.enabled) {
            const annType = levelCfg.announcement_type || 'channel';
            const annText = `<:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> Tebrikler <@${member.id}>! Seviye atladın ve **${newStats.level}. Seviye** oldun! <:mono:${MONO_EMOJIS.party_popper || '1548248461206487072'}>`;
            const payload = createContainerMessage(
                `Seviye Atlandı!`,
                annText,
                COLORS.PRIMARY || '#5865F2'
            );

            try {
                // Chat'i boğmaması için mesajları gönderip 10 saniye sonra siliyoruz!
                let sentMsg = null;
                if (annType === 'dm') {
                    await member.send(payload).catch(() => {});
                } else if (annType === 'current' && currentChannel) {
                    sentMsg = await currentChannel.send(payload).catch(() => {});
                } else if (annType === 'channel' && levelCfg.announcement_channel_id) {
                    const ch = guild.channels.cache.get(levelCfg.announcement_channel_id);
                    if (ch) sentMsg = await ch.send(payload).catch(() => {});
                } else if (currentChannel) {
                    sentMsg = await currentChannel.send(payload).catch(() => {});
                }
                
                if (sentMsg) {
                    setTimeout(() => {
                        sentMsg.delete().catch(() => {});
                    }, 10000);
                }
            } catch (e) {
                console.error('[LevelUp Notice Error]:', e.message);
            }
        }
    }
}

function isLevelSystemActive(levelCfg) {
    if (!levelCfg) return false;
    if (!levelCfg.enabled) return false;
    return true;
}

// --- MESAJ XP İŞLEYİCİ ---

async function processMessageXP(message) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    const levelCfg = await getLevelConfig(guildId).catch(() => null);
    if (!isLevelSystemActive(levelCfg)) return;

    // Muafiyet Kontrolleri
    if (levelCfg.exempt_channels && Array.isArray(levelCfg.exempt_channels)) {
        if (levelCfg.exempt_channels.includes(message.channel.id) || (message.channel.parentId && levelCfg.exempt_channels.includes(message.channel.parentId))) {
            return;
        }
    }

    if (levelCfg.exempt_roles && Array.isArray(levelCfg.exempt_roles) && message.member && message.member.roles) {
        if (message.member.roles.cache.some(r => levelCfg.exempt_roles.includes(r.id))) {
            return;
        }
    }

    const userData = await getLevelUser(guildId, userId);
    const now = Date.now();
    const cooldownMs = (levelCfg.cooldown_secs || 60) * 1000;

    let gainedXP = 0;
    let isEligibleForXP = (now - (userData.last_xp_at || 0)) >= cooldownMs;

    if (isEligibleForXP && levelCfg.msg_xp > 0) {
        gainedXP = Number(levelCfg.msg_xp);
    }

    const oldXP = Number(userData.xp || 0);
    const updatedUser = await addLevelUserXP(guildId, userId, gainedXP, true, 0, isEligibleForXP ? now : null);
    const newXP = Number(updatedUser.xp || 0);

    if (gainedXP > 0) {
        await checkAndApplyLevelUp(message.client, message.guild, message.member, oldXP, newXP, levelCfg, message.channel);
    }
}

// --- SESLİ, KAMERA VE YAYIN XP İŞLEYİCİ (REAL-TIME ENGINE) ---

let voiceXpInterval = null;

function initVoiceXpEngine(client) {
    if (voiceXpInterval) clearInterval(voiceXpInterval);

    voiceXpInterval = setInterval(async () => {
        try {
            for (const guild of client.guilds.cache.values()) {
                const levelCfg = await getLevelConfig(guild.id).catch(() => null);
                if (!levelCfg || !levelCfg.enabled || levelCfg.voice_xp <= 0) continue;

                const baseVoiceXP = Number(levelCfg.voice_xp);
                const afkChannelId = guild.afkChannelId;

                for (const channel of guild.channels.cache.values()) {
                    if (!channel.isVoiceBased() || channel.id === afkChannelId) continue;
                    if (levelCfg.exempt_channels && Array.isArray(levelCfg.exempt_channels) && (levelCfg.exempt_channels.includes(channel.id) || (channel.parentId && levelCfg.exempt_channels.includes(channel.parentId)))) continue;

                    for (const member of channel.members.values()) {
                        if (member.user.bot) continue;
                        if (levelCfg.exempt_roles && Array.isArray(levelCfg.exempt_roles) && member.roles.cache.some(r => levelCfg.exempt_roles.includes(r.id))) continue;

                        // Kulaklığı kapalı (sağır) olanlar hariç
                        const isDeaf = member.voice.selfDeaf || member.voice.serverDeaf;
                        if (isDeaf) continue;

                        // Kamera ve Yayın Çarpanları (+%50 Bonus)
                        let multiplier = 1.0;
                        if (member.voice.selfVideo) multiplier += 0.5; // Kamera açık: 1.5x
                        if (member.voice.streaming) multiplier += 0.5; // Ekran paylaşımı / yayın açık: 1.5x

                        const finalXP = Math.max(1, Math.round(baseVoiceXP * multiplier));

                        const userData = await getLevelUser(guild.id, member.id);
                        const oldXP = Number(userData.xp || 0);
                        const updatedUser = await addLevelUserXP(guild.id, member.id, finalXP, false, 60, null);
                        const newXP = Number(updatedUser.xp || 0);

                        await checkAndApplyLevelUp(client, guild, member, oldXP, newXP, levelCfg, null);
                    }
                }
            }
        } catch (err) {
            console.error('[VoiceXpEngine Error]:', err.message);
        }
    }, 60000);
}

async function processVoiceXP(guild, member, durationSecs) {
    if (!guild || !member || member.user.bot) return;
    if (durationSecs < 60) return; // En az 1 dakika

    const guildId = guild.id;
    const userId = member.id;

    const levelCfg = await getLevelConfig(guildId).catch(() => null);
    if (!isLevelSystemActive(levelCfg) || levelCfg.voice_xp <= 0) return;

    // Muafiyet kontrolleri
    if (levelCfg.exempt_roles && Array.isArray(levelCfg.exempt_roles) && member.roles) {
        if (member.roles.cache.some(r => levelCfg.exempt_roles.includes(r.id))) return;
    }

    const earnedMinutes = Math.floor(durationSecs / 60);
    let multiplier = 1.0;
    if (member.voice?.selfVideo) multiplier += 0.5;
    if (member.voice?.streaming) multiplier += 0.5;

    const gainedXP = Math.round(earnedMinutes * Number(levelCfg.voice_xp) * multiplier);
    if (gainedXP <= 0) return;

    const userData = await getLevelUser(guildId, userId);
    const oldXP = Number(userData.xp || 0);
    const updatedUser = await addLevelUserXP(guildId, userId, gainedXP, false, durationSecs, null);
    const newXP = Number(updatedUser.xp || 0);

    const { trackVoiceQuest } = require('./questManager');
    trackVoiceQuest(guildId, userId, earnedMinutes).catch(() => {});

    await checkAndApplyLevelUp(member.client, guild, member, oldXP, newXP, levelCfg, null);
}

// --- DAVET XP İŞLEYİCİ ---

async function processInviteXP(guild, inviterId) {
    if (!guild || !inviterId) return;

    const guildId = guild.id;
    const levelCfg = await getLevelConfig(guildId).catch(() => null);
    if (!isLevelSystemActive(levelCfg)) return;

    const inviteXP = Number(levelCfg.invite_xp || 0);
    const userData = await getLevelUser(guildId, inviterId);
    const oldXP = Number(userData.xp || 0);
    const updatedUser = await addLevelUserInvites(guildId, inviterId, 1, inviteXP);
    const newXP = Number(updatedUser.xp || 0);

    const member = await guild.members.fetch(inviterId).catch(() => null);
    if (member && inviteXP > 0) {
        await checkAndApplyLevelUp(guild.client, guild, member, oldXP, newXP, levelCfg, null);
    }
}

// --- V2 KONTROL PANELİ OLUŞTURUCULARI ---

async function buildLevelPanel(guildId) {
    const cfg = await getLevelConfig(guildId);
    const rewards = await getLevelRewards(guildId);

    const isEnabled = cfg.enabled;
    const statusEmoji = isEnabled ? `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}>` : `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}>`;
    const statusText = isEnabled ? 'Aktif' : 'Devre Dışı';

    let annTypeText = 'Sabit Kanal';
    if (cfg.announcement_type === 'current') annTypeText = 'Mesaj Yazdığı Kanal';
    if (cfg.announcement_type === 'dm') annTypeText = 'Özel Mesaj (DM)';

    const annChannelText = cfg.announcement_channel_id ? `<#${cfg.announcement_channel_id}>` : '`Ayarlanmamış`';
    const rewardModeText = cfg.reward_mode === 'single' ? 'Tek Rütbe (Eski roller silinir)' : 'Birikimli (Eski roller kalır)';

    const exemptChansCount = Array.isArray(cfg.exempt_channels) ? cfg.exempt_channels.length : 0;
    const exemptRolesCount = Array.isArray(cfg.exempt_roles) ? cfg.exempt_roles.length : 0;

    const desc = [
        `**Sistem Durumu:** ${statusEmoji} ${statusText}`,
        `**Duyuru Türü:** \`${annTypeText}\` | **Kanal:** ${annChannelText}`,
        `**Ödül Dağıtım Modu:** \`${rewardModeText}\` (${rewards.length} Adet Tanımlı)`,
        ``,
        `<:mono:${MONO_EMOJIS.settings || '1530917511711948903'}> **XP Kazanım Değerleri:**`,
        `> • **Mesaj Başına XP:** \`${cfg.msg_xp} XP\` (Bekleme: \`${cfg.cooldown_secs} sn\`)`,
        `> • **Ses Dakikası Başına XP:** \`${cfg.voice_xp} XP\``,
        `> • **Seviye Başına XP:** \`${cfg.xp_per_level} XP\` (Formül: \`N * ${cfg.xp_per_level}\`)`,
        `> • **Davet Başına XP:** \`${cfg.invite_xp} XP\``,
        ``,
        `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Muafiyetler:**`,
        `> • **Muaf Kanallar:** \`${exemptChansCount} Kanal/Kategori\``,
        `> • **Muaf Roller:** \`${exemptRolesCount} Rol\``,
        ``,
        `*Aşağıdaki butonları kullanarak sistem ayarlarını, muafiyetleri ve seviye ödüllerini anında yapılandırabilirsiniz.*`
    ].join('\n');

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('level_select_main_menu')
            .setPlaceholder('Seviye Yönetim İşlemleri Menüsü')
            .addOptions([
                {
                    label: 'Kurulum & Duyuru Ayarları',
                    description: 'Duyuru kanalı ve bildirim türünü belirleyin',
                    value: 'setup',
                    emoji: MONO_EMOJIS.announcement || '1530917526391750676'
                },
                {
                    label: 'XP Kazanım Ayarları',
                    description: 'Mesaj/Ses XP, çarpan ve bekleme süresini ayarlayın',
                    value: 'xp_settings',
                    emoji: MONO_EMOJIS.settings || '1530917511711948903'
                },
                {
                    label: 'XP Muafiyetleri',
                    description: 'XP kazanımı kapalı kanalları ve rolleri seçin',
                    value: 'exemptions',
                    emoji: MONO_EMOJIS.shield || '1530917506867400775'
                },
                {
                    label: 'Seviye Rol Ödülleri',
                    description: 'Seviyelere atanacak rolleri ve modları yönetin',
                    value: 'rewards',
                    emoji: MONO_EMOJIS.crown || '1530918952711094272'
                },
                {
                    label: 'Kullanıcıya XP / Seviye Ver',
                    description: 'Seçtiğiniz üyeye manuel XP veya seviye ekleyin',
                    value: 'give_xp',
                    emoji: MONO_EMOJIS.add || '1530917531450343474'
                },
                {
                    label: 'Kullanıcıdan XP / Seviye Al (Düşür)',
                    description: 'Seçtiğiniz üyeden manuel XP düşürün veya ceza verin',
                    value: 'take_xp',
                    emoji: MONO_EMOJIS.minus || '1537769949215596584'
                },
                {
                    label: isEnabled ? 'Sistemi Kapat (Durdur)' : 'Sistemi Aç (Aktifleştir)',
                    description: isEnabled ? 'Seviye sistemini devre dışı bırakır' : 'Seviye sistemini aktifleştirir',
                    value: 'toggle',
                    emoji: isEnabled ? (MONO_EMOJIS.lock || '1530918940065267712') : (MONO_EMOJIS.unlock || '1530918955726667867')
                },
                {
                    label: 'Tüm Seviyeleri Sıfırla',
                    description: 'Sunucudaki tüm seviye ve XP verilerini sıfırlar',
                    value: 'reset',
                    emoji: MONO_EMOJIS.delete || '1530918957349867711'
                }
            ])
    );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('level_btn_setup')
            .setLabel('Kurulum & Duyuru')
            .setEmoji(MONO_EMOJIS.announcement || '1530917526391750676')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('level_btn_rewards')
            .setLabel('Seviye Ödülleri')
            .setEmoji(MONO_EMOJIS.crown || '1530918952711094272')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('level_btn_toggle')
            .setLabel(isEnabled ? 'Kapat' : 'Aç')
            .setEmoji(isEnabled ? (MONO_EMOJIS.lock || '1530918940065267712') : (MONO_EMOJIS.unlock || '1530918955726667867'))
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    return createContainerMessage(
        'Seviye Sistemi Yönetim Paneli',
        desc,
        COLORS.PRIMARY || '#5865F2',
        [menuRow, btnRow]
    );
}

async function buildLevelRewardsPanel(guildId) {
    const cfg = await getLevelConfig(guildId);
    const rewards = await getLevelRewards(guildId);

    const isSingle = cfg.reward_mode === 'single';
    const modeText = isSingle ? 'Tek Rütbe — önceki rütbeler üyeden alınır.' : 'Ödül rolleri birikiyor — eski rütbeler üyede kalır.';

    let rewardListText = 'Henüz ödül tanımlanmamış.';
    if (rewards && rewards.length > 0) {
        rewardListText = rewards.map(r => `> • **${r.level}. Seviye:** <@&${r.role_id}>`).join('\n');
    }

    const desc = [
        `Belirlenen seviyeye ulaşan üyeye rol otomatik verilir.`,
        ``,
        rewardListText,
        ``,
        `${modeText}`,
        `En fazla 20 ödül tanımlanabilir.`
    ].join('\n');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('level_btn_add_reward')
            .setLabel('Ödül Ekle')
            .setEmoji(MONO_EMOJIS.add || '1530917531450343474')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('level_btn_toggle_mode')
            .setLabel(isSingle ? 'Birikimli Mod Yap' : 'Tek Rütbe Mod Yap')
            .setEmoji(MONO_EMOJIS.settings || '1530917511711948903')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('level_btn_back')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary)
    );

    const components = [row1];

    if (rewards && rewards.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('level_select_remove_reward')
            .setPlaceholder('Kaldırılacak ödülü seç')
            .addOptions(
                rewards.slice(0, 25).map(r => ({
                    label: `${r.level}. Seviye Ödülü`,
                    description: `Rol ID: ${r.role_id}`,
                    value: String(r.id),
                    emoji: MONO_EMOJIS.delete || '1530918957349867711'
                }))
            );
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return createContainerMessage(
        'Seviye Ödülleri',
        desc,
        COLORS.PRIMARY || '#5865F2',
        components
    );
}

// --- INTERACTION / ETKİLEŞİM YÖNETİCİSİ ---

async function handleLevelInteraction(interaction, client) {
    if (!interaction.customId.startsWith('level_')) return false;

    // Yetki Kontrolü
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
            ...createContainerMessage(
                'Yetki Yetersiz',
                'Seviye sistemini yönetmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız.',
                COLORS.ERROR || '#ED4245'
            ),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
        }).catch(() => {});
        return true;
    }

    const guildId = interaction.guildId;
    const customId = interaction.customId;

    // 0. ANA SEÇİM MENÜSÜ YÖNLENDİRİCİSİ (SELECT MENU)
    if (customId === 'level_select_main_menu') {
        const selected = interaction.values[0];

        if (selected === 'setup') {
            await interaction.deferUpdate().catch(() => {});
            const cfg = await getLevelConfig(guildId);
            const desc = [
                `**Seviye atlama duyurusu nereye gitsin?**`,
                `> • **Duyuru Kanalı:** Seviye atlayan herkes sabit bir kanala yazılır.`,
                `> • **Yazdığı Kanal:** Duyuru, kişinin o an konuştuğu kanala düşer.`,
                `> • **Özel Mesaj:** Kanalda kimse görmez, sadece kişiye DM gider.`,
                ``,
                `*Aşağıdaki menülerden duyuru kanalını ve gönderim tipini belirleyebilirsiniz.*`
            ].join('\n');

            const channelSelect = new ChannelSelectMenuBuilder()
                .setCustomId('level_select_ann_channel')
                .setPlaceholder('Duyuru Kanalı Seçin')
                .setChannelTypes(ChannelType.GuildText);

            const typeSelect = new StringSelectMenuBuilder()
                .setCustomId('level_select_ann_type')
                .setPlaceholder('Duyuru Gönderim Tipini Seçin')
                .addOptions([
                    { label: 'Duyuru Kanalı (Sabit)', value: 'channel', description: 'Seviye atlayan herkes aynı kanala yazılır.', default: cfg.announcement_type === 'channel' },
                    { label: 'Yazdığı Kanal', value: 'current', description: 'Duyuru, kişinin o an konuştuğu kanala düşer.', default: cfg.announcement_type === 'current' },
                    { label: 'Özel Mesaj (DM)', value: 'dm', description: 'Kanalda kimse görmez, sadece kişiye DM gider.', default: cfg.announcement_type === 'dm' }
                ]);

            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('level_btn_back')
                    .setLabel('Geri')
                    .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                    .setStyle(ButtonStyle.Secondary)
            );

            const payload = createContainerMessage(
                'Seviye Kurulumu',
                desc,
                COLORS.PRIMARY || '#5865F2',
                [new ActionRowBuilder().addComponents(channelSelect), new ActionRowBuilder().addComponents(typeSelect), backRow]
            );

            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (selected === 'xp_settings') {
            const cfg = await getLevelConfig(guildId);
            const modal = new ModalBuilder()
                .setCustomId('level_modal_xp_settings')
                .setTitle('XP Ayarları');

            const msgInput = new TextInputBuilder()
                .setCustomId('msg_xp')
                .setLabel('Mesaj Başına XP (0-100)')
                .setPlaceholder('Örn: 1 (0 yazarsan mesaj XP vermez)')
                .setValue(String(cfg.msg_xp ?? 1))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const voiceInput = new TextInputBuilder()
                .setCustomId('voice_xp')
                .setLabel('Ses Dakikası Başına XP (0-100)')
                .setPlaceholder('Örn: 2 (AFK / Sağır sayılmaz)')
                .setValue(String(cfg.voice_xp ?? 2))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const levelXpInput = new TextInputBuilder()
                .setCustomId('xp_per_level')
                .setLabel('Seviye Başına XP')
                .setPlaceholder('Örn: 99 (N * bu değer kadar XP gerekir)')
                .setValue(String(cfg.xp_per_level ?? 99))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const cooldownInput = new TextInputBuilder()
                .setCustomId('cooldown_secs')
                .setLabel('Bekleme Süresi (Saniye)')
                .setPlaceholder('Örn: 60')
                .setValue(String(cfg.cooldown_secs ?? 60))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inviteXpInput = new TextInputBuilder()
                .setCustomId('invite_xp')
                .setLabel('Davet Başına Bonus XP')
                .setPlaceholder('Örn: 50')
                .setValue(String(cfg.invite_xp ?? 50))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(msgInput),
                new ActionRowBuilder().addComponents(voiceInput),
                new ActionRowBuilder().addComponents(levelXpInput),
                new ActionRowBuilder().addComponents(cooldownInput),
                new ActionRowBuilder().addComponents(inviteXpInput)
            );

            await interaction.showModal(modal).catch(() => {});
            return true;
        }

        if (selected === 'exemptions') {
            await interaction.deferUpdate().catch(() => {});
            const cfg = await getLevelConfig(guildId);
            const desc = [
                `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **XP Muafiyetleri Yönetimi**`,
                `Belirttiğiniz kanallarda veya rollere sahip kullanıcılarda XP kazanımı tamamen durdurulur.`,
                ``,
                `> • **Muaf Kanallar:** ${cfg.exempt_channels.length > 0 ? cfg.exempt_channels.map(id => `<#${id}>`).join(', ') : '`Yok`'}`,
                `> • **Muaf Roller:** ${cfg.exempt_roles.length > 0 ? cfg.exempt_roles.map(id => `<@&${id}>`).join(', ') : '`Yok`'}`
            ].join('\n');

            const chanSelect = new ChannelSelectMenuBuilder()
                .setCustomId('level_select_exempt_chans')
                .setPlaceholder('XP Kazandırmayan Kanalları Seçin')
                .setMinValues(0)
                .setMaxValues(10)
                .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory);

            const roleSelect = new RoleSelectMenuBuilder()
                .setCustomId('level_select_exempt_roles')
                .setPlaceholder('XP Kazanmayan Rolleri Seçin')
                .setMinValues(0)
                .setMaxValues(10);

            const clearBtn = new ButtonBuilder()
                .setCustomId('level_btn_clear_exemptions')
                .setLabel('Muafiyetleri Temizle')
                .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
                .setStyle(ButtonStyle.Danger);

            const backBtn = new ButtonBuilder()
                .setCustomId('level_btn_back')
                .setLabel('Geri')
                .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                .setStyle(ButtonStyle.Secondary);

            const payload = createContainerMessage(
                'XP Muafiyetleri',
                desc,
                COLORS.PRIMARY || '#5865F2',
                [
                    new ActionRowBuilder().addComponents(chanSelect),
                    new ActionRowBuilder().addComponents(roleSelect),
                    new ActionRowBuilder().addComponents(clearBtn, backBtn)
                ]
            );

            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (selected === 'rewards') {
            await interaction.deferUpdate().catch(() => {});
            const payload = await buildLevelRewardsPanel(guildId);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (selected === 'give_xp') {
            await interaction.deferUpdate().catch(() => {});
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('level_select_give_user')
                .setPlaceholder('XP verilecek kullanıcıyı seçin');

            const cancelBtn = new ButtonBuilder()
                .setCustomId('level_btn_back')
                .setLabel('İptal / Geri')
                .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                .setStyle(ButtonStyle.Secondary);

            const payload = createContainerMessage(
                'Kullanıcı Seçin',
                'Lütfen XP veya Seviye eklemek istediğiniz üyeyi aşağıdaki menüden seçin:',
                COLORS.PRIMARY || '#5865F2',
                [
                    new ActionRowBuilder().addComponents(userSelect),
                    new ActionRowBuilder().addComponents(cancelBtn)
                ]
            );

            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (selected === 'take_xp') {
            await interaction.deferUpdate().catch(() => {});
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('level_select_take_user')
                .setPlaceholder('XP düşürülecek kullanıcıyı seçin');

            const cancelBtn = new ButtonBuilder()
                .setCustomId('level_btn_back')
                .setLabel('İptal / Geri')
                .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                .setStyle(ButtonStyle.Secondary);

            const payload = createContainerMessage(
                'Kullanıcı Seçin (XP Düşür)',
                'Lütfen XP veya Seviye düşürmek istediğiniz üyeyi aşağıdaki menüden seçin:',
                COLORS.ERROR || '#ED4245',
                [
                    new ActionRowBuilder().addComponents(userSelect),
                    new ActionRowBuilder().addComponents(cancelBtn)
                ]
            );

            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (selected === 'toggle') {
            await interaction.deferUpdate().catch(() => {});
            const cfg = await getLevelConfig(guildId);
            await updateLevelConfig(guildId, { enabled: !cfg.enabled });
            const payload = await buildLevelPanel(guildId);
            await interaction.editReply(payload).catch(() => {});
            return true;
        }

        if (selected === 'reset') {
            await interaction.deferUpdate().catch(() => {});
            const confirmBtn = new ButtonBuilder()
                .setCustomId('level_btn_reset_all_confirm')
                .setLabel('Evet, Tüm Seviyeleri Sıfırla')
                .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
                .setStyle(ButtonStyle.Danger);

            const cancelBtn = new ButtonBuilder()
                .setCustomId('level_btn_back')
                .setLabel('İptal')
                .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                .setStyle(ButtonStyle.Secondary);

            const payload = createContainerMessage(
                'Tüm Seviyeleri Sıfırla',
                `**UYARI:** Bu işlem sunucudaki tüm üyelerin seviye, XP, mesaj ve ses istatistiklerini kalıcı olarak sıfırlayacaktır.\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`,
                COLORS.ERROR || '#ED4245',
                [new ActionRowBuilder().addComponents(confirmBtn, cancelBtn)]
            );

            await interaction.editReply(payload).catch(() => {});
            return true;
        }
    }

    // 1. ANA PANEL GERİ DÖNÜŞ
    if (customId === 'level_btn_back') {
        await interaction.deferUpdate().catch(() => {});
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 2. SİSTEM AÇ / KAPAT
    if (customId === 'level_btn_toggle') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = await getLevelConfig(guildId);
        await updateLevelConfig(guildId, { enabled: !cfg.enabled });
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 3. KURULUM & DUYURU PANELİ (SS 1)
    if (customId === 'level_btn_setup') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = await getLevelConfig(guildId);

        const desc = [
            `**Seviye atlama duyurusu nereye gitsin?**`,
            `> • **Duyuru Kanalı:** Seviye atlayan herkes sabit bir kanala yazılır.`,
            `> • **Yazdığı Kanal:** Duyuru, kişinin o an konuştuğu kanala düşer.`,
            `> • **Özel Mesaj:** Kanalda kimse görmez, sadece kişiye DM gider.`,
            ``,
            `*Aşağıdaki menülerden duyuru kanalını ve gönderim tipini belirleyebilirsiniz.*`
        ].join('\n');

        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId('level_select_ann_channel')
            .setPlaceholder('Duyuru Kanalı Seçin')
            .setChannelTypes(ChannelType.GuildText);

        const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('level_select_ann_type')
            .setPlaceholder('Duyuru Gönderim Tipini Seçin')
            .addOptions([
                { label: 'Duyuru Kanalı (Sabit)', value: 'channel', description: 'Seviye atlayan herkes aynı kanala yazılır.', default: cfg.announcement_type === 'channel' },
                { label: 'Yazdığı Kanal', value: 'current', description: 'Duyuru, kişinin o an konuştuğu kanala düşer.', default: cfg.announcement_type === 'current' },
                { label: 'Özel Mesaj (DM)', value: 'dm', description: 'Kanalda kimse görmez, sadece kişiye DM gider.', default: cfg.announcement_type === 'dm' }
            ]);

        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('level_btn_back')
                .setLabel('Geri')
                .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                .setStyle(ButtonStyle.Secondary)
        );

        const payload = createContainerMessage(
            'Seviye Kurulumu',
            desc,
            COLORS.PRIMARY || '#5865F2',
            [new ActionRowBuilder().addComponents(channelSelect), new ActionRowBuilder().addComponents(typeSelect), backRow]
        );

        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 3.1 DUYURU KANALI SEÇİMİ
    if (customId === 'level_select_ann_channel') {
        await interaction.deferUpdate().catch(() => {});
        const selectedChannelId = interaction.values[0];
        await updateLevelConfig(guildId, { announcement_channel_id: selectedChannelId });
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 3.2 DUYURU TİPİ SEÇİMİ
    if (customId === 'level_select_ann_type') {
        await interaction.deferUpdate().catch(() => {});
        const selectedType = interaction.values[0];
        await updateLevelConfig(guildId, { announcement_type: selectedType });
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 4. XP AYARLARI MODALI (SS 2)
    if (customId === 'level_btn_xp_settings') {
        const cfg = await getLevelConfig(guildId);
        const modal = new ModalBuilder()
            .setCustomId('level_modal_xp_settings')
            .setTitle('XP Ayarları');

        const msgInput = new TextInputBuilder()
            .setCustomId('msg_xp')
            .setLabel('Mesaj Başına XP (0-100)')
            .setPlaceholder('Örn: 15 (0 yazarsan mesaj XP vermez)')
            .setValue(String(cfg.msg_xp ?? 15))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const voiceInput = new TextInputBuilder()
            .setCustomId('voice_xp')
            .setLabel('Ses Dakikası Başına XP (0-100)')
            .setPlaceholder('Örn: 10 (AFK / Sağır sayılmaz)')
            .setValue(String(cfg.voice_xp ?? 10))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const levelXpInput = new TextInputBuilder()
            .setCustomId('xp_per_level')
            .setLabel('Seviye Başına XP')
            .setPlaceholder('Örn: 100 (N * bu değer kadar XP gerekir)')
            .setValue(String(cfg.xp_per_level ?? 100))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const cooldownInput = new TextInputBuilder()
            .setCustomId('cooldown_secs')
            .setLabel('Bekleme Süresi (Saniye)')
            .setPlaceholder('Örn: 60')
            .setValue(String(cfg.cooldown_secs ?? 60))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const inviteXpInput = new TextInputBuilder()
            .setCustomId('invite_xp')
            .setLabel('Davet Başına Bonus XP')
            .setPlaceholder('Örn: 200')
            .setValue(String(cfg.invite_xp ?? 200))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(msgInput),
            new ActionRowBuilder().addComponents(voiceInput),
            new ActionRowBuilder().addComponents(levelXpInput),
            new ActionRowBuilder().addComponents(cooldownInput),
            new ActionRowBuilder().addComponents(inviteXpInput)
        );

        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    // 4.1 XP AYARLARI MODAL SUBMIT
    if (customId === 'level_modal_xp_settings') {
        await interaction.deferUpdate().catch(() => {});
        const msgXP = Math.max(0, Math.min(100, parseInt(interaction.fields.getTextInputValue('msg_xp'), 10) || 15));
        const voiceXP = Math.max(0, Math.min(100, parseInt(interaction.fields.getTextInputValue('voice_xp'), 10) || 10));
        const xpPerLevel = Math.max(10, Math.min(10000, parseInt(interaction.fields.getTextInputValue('xp_per_level'), 10) || 100));
        const cooldownSecs = Math.max(0, Math.min(3600, parseInt(interaction.fields.getTextInputValue('cooldown_secs'), 10) || 60));
        const inviteXP = Math.max(0, Math.min(5000, parseInt(interaction.fields.getTextInputValue('invite_xp'), 10) || 200));

        await updateLevelConfig(guildId, {
            msg_xp: msgXP,
            voice_xp: voiceXP,
            xp_per_level: xpPerLevel,
            cooldown_secs: cooldownSecs,
            invite_xp: inviteXP
        });

        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 5. XP MUAFIYETLERİ PANELİ (SS 3)
    if (customId === 'level_btn_exemptions') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = await getLevelConfig(guildId);

        const desc = [
            `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **XP Muafiyetleri Yönetimi**`,
            `Belirttiğiniz kanallarda veya rollere sahip kullanıcılarda XP kazanımı tamamen durdurulur.`,
            ``,
            `> • **Muaf Kanallar:** ${cfg.exempt_channels.length > 0 ? cfg.exempt_channels.map(id => `<#${id}>`).join(', ') : '`Yok`'}`,
            `> • **Muaf Roller:** ${cfg.exempt_roles.length > 0 ? cfg.exempt_roles.map(id => `<@&${id}>`).join(', ') : '`Yok`'}`
        ].join('\n');

        const chanSelect = new ChannelSelectMenuBuilder()
            .setCustomId('level_select_exempt_chans')
            .setPlaceholder('XP Kazandırmayan Kanalları Seçin')
            .setMinValues(0)
            .setMaxValues(10)
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory);

        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId('level_select_exempt_roles')
            .setPlaceholder('XP Kazanmayan Rolleri Seçin')
            .setMinValues(0)
            .setMaxValues(10);

        const clearBtn = new ButtonBuilder()
            .setCustomId('level_btn_clear_exemptions')
            .setLabel('Muafiyetleri Temizle')
            .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
            .setStyle(ButtonStyle.Danger);

        const backBtn = new ButtonBuilder()
            .setCustomId('level_btn_back')
            .setLabel('Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary);

        const payload = createContainerMessage(
            'XP Muafiyetleri',
            desc,
            COLORS.PRIMARY || '#5865F2',
            [
                new ActionRowBuilder().addComponents(chanSelect),
                new ActionRowBuilder().addComponents(roleSelect),
                new ActionRowBuilder().addComponents(clearBtn, backBtn)
            ]
        );

        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 5.1 MUAFIYET KANAL SEÇİMİ
    if (customId === 'level_select_exempt_chans') {
        await interaction.deferUpdate().catch(() => {});
        await updateLevelConfig(guildId, { exempt_channels: interaction.values });
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 5.2 MUAFIYET ROL SEÇİMİ
    if (customId === 'level_select_exempt_roles') {
        await interaction.deferUpdate().catch(() => {});
        await updateLevelConfig(guildId, { exempt_roles: interaction.values });
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 5.3 MUAFIYETLERİ TEMİZLE
    if (customId === 'level_btn_clear_exemptions') {
        await interaction.deferUpdate().catch(() => {});
        await updateLevelConfig(guildId, { exempt_channels: [], exempt_roles: [] });
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 6. SEVİYE ÖDÜLLERİ PANELİ (SS 4)
    if (customId === 'level_btn_rewards') {
        await interaction.deferUpdate().catch(() => {});
        const payload = await buildLevelRewardsPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 6.1 ÖDÜL MODU DEĞİŞTİR (Tek Rütbe vs Birikimli)
    if (customId === 'level_btn_toggle_mode') {
        await interaction.deferUpdate().catch(() => {});
        const cfg = await getLevelConfig(guildId);
        const newMode = cfg.reward_mode === 'single' ? 'stack' : 'single';
        await updateLevelConfig(guildId, { reward_mode: newMode });
        const payload = await buildLevelRewardsPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 6.2 ÖDÜL EKLE BUTONU -> Önce Seviye Soran Modal
    if (customId === 'level_btn_add_reward') {
        const modal = new ModalBuilder()
            .setCustomId('level_modal_add_reward_step1')
            .setTitle('Seviye Ödülü Ekle');

        const levelInput = new TextInputBuilder()
            .setCustomId('reward_level')
            .setLabel('Hangi Seviye İçin? (2-1000)')
            .setPlaceholder('Örn: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(levelInput));
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    // 6.3 ÖDÜL EKLE STEP 1 SUBMIT -> Rol Seçim Menüsü Göster
    if (customId === 'level_modal_add_reward_step1') {
        await interaction.deferUpdate().catch(() => {});
        const level = parseInt(interaction.fields.getTextInputValue('reward_level'), 10);

        if (!level || level < 1) {
            const errPayload = createContainerMessage(
                'Geçersiz Seviye',
                'Lütfen 1 veya daha büyük geçerli bir seviye sayısı giriniz.',
                COLORS.ERROR || '#ED4245'
            );
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId(`level_select_reward_role_${level}`)
            .setPlaceholder(`${level}. Seviye için verilecek rolü seçin`);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('level_btn_rewards')
            .setLabel('İptal / Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary);

        const payload = createContainerMessage(
            'Seviye Ödülü Rolü Seçin',
            `**Hedef Seviye:** \`${level}. Seviye\`\n\nLütfen bu seviyeye ulaşan üyeye otomatik verilecek rolü aşağıdaki menüden seçin:`,
            COLORS.PRIMARY || '#5865F2',
            [
                new ActionRowBuilder().addComponents(roleSelect),
                new ActionRowBuilder().addComponents(cancelBtn)
            ]
        );

        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 6.4 ÖDÜL ROLÜ SEÇİLDİĞİNDE -> DB'ye kaydet ve Ödüller Paneline dön
    if (customId.startsWith('level_select_reward_role_')) {
        await interaction.deferUpdate().catch(() => {});
        const level = parseInt(customId.replace('level_select_reward_role_', ''), 10);
        const roleId = interaction.values[0];

        if (level && roleId) {
            await addLevelReward(guildId, level, roleId);
        }

        const payload = await buildLevelRewardsPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 6.5 ÖDÜL SİL SEÇİMİ
    if (customId === 'level_select_remove_reward') {
        await interaction.deferUpdate().catch(() => {});
        const rewardId = parseInt(interaction.values[0], 10);
        if (rewardId) {
            await removeLevelReward(guildId, rewardId);
        }
        const payload = await buildLevelRewardsPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 7. XP / SEVİYE VER BUTONU -> Önce Kullanıcı Seçim Menüsü Göster
    if (customId === 'level_btn_give_xp') {
        await interaction.deferUpdate().catch(() => {});

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('level_select_give_user')
            .setPlaceholder('XP verilecek kullanıcıyı seçin');

        const cancelBtn = new ButtonBuilder()
            .setCustomId('level_btn_back')
            .setLabel('İptal / Geri')
            .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
            .setStyle(ButtonStyle.Secondary);

        const payload = createContainerMessage(
            'Kullanıcı Seçin',
            'Lütfen XP veya Seviye eklemek istediğiniz üyeyi aşağıdaki menüden seçin:',
            COLORS.PRIMARY || '#5865F2',
            [
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(cancelBtn)
            ]
        );

        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 7.1 KULLANICI SEÇİLDİĞİNDE -> XP Miktarını Soran Modal Aç
    if (customId === 'level_select_give_user') {
        const targetUserId = interaction.values[0];
        const modal = new ModalBuilder()
            .setCustomId(`level_modal_give_xp_amount_${targetUserId}`)
            .setTitle('XP Miktarını Girin');

        const xpInput = new TextInputBuilder()
            .setCustomId('add_xp')
            .setLabel('Eklenecek XP Miktarı')
            .setPlaceholder('Örn: 500')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(xpInput));
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    // 7.2 XP MİKTARI GİRİLDİĞİNDE SUBMIT
    if (customId.startsWith('level_modal_give_xp_amount_')) {
        await interaction.deferUpdate().catch(() => {});
        const targetUserId = customId.replace('level_modal_give_xp_amount_', '');
        const amount = parseInt(interaction.fields.getTextInputValue('add_xp'), 10);

        if (!targetUserId || isNaN(amount) || amount <= 0) {
            const errPayload = createContainerMessage(
                'Geçersiz Girdi',
                'Lütfen pozitif bir XP sayısı giriniz.',
                COLORS.ERROR || '#ED4245'
            );
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!member) {
            const errPayload = createContainerMessage(
                'Kullanıcı Bulunamadı',
                `Sunucuda seçilen üye bulunamadı.`,
                COLORS.ERROR || '#ED4245'
            );
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const userData = await getLevelUser(guildId, targetUserId);
        const oldXP = Number(userData.xp || 0);
        const updated = await addLevelUserXP(guildId, targetUserId, amount, false, 0, null);
        const newXP = Number(updated.xp || 0);

        const cfg = await getLevelConfig(guildId);
        await checkAndApplyLevelUp(client, interaction.guild, member, oldXP, newXP, cfg, null);

        const successPayload = createContainerMessage(
            'XP Başarıyla Verildi',
            `<@${targetUserId}> kullanıcısına **+${amount} XP** eklendi!\nYeni Toplam XP: **${newXP}**`,
            COLORS.SUCCESS || '#57F287'
        );
        await interaction.followUp({ ...successPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        return true;
    }

    // 7.3 KULLANICI SEÇİLDİĞİNDE (XP DÜŞÜRME) -> Modal Aç
    if (customId === 'level_select_take_user') {
        const targetUserId = interaction.values[0];
        const modal = new ModalBuilder()
            .setCustomId(`level_modal_take_xp_amount_${targetUserId}`)
            .setTitle('Düşülecek XP Miktarını Girin');

        const xpInput = new TextInputBuilder()
            .setCustomId('take_xp_amount')
            .setLabel('Düşürülecek XP Sayısı')
            .setPlaceholder('Örn: 500')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(xpInput));
        await interaction.showModal(modal).catch(() => {});
        return true;
    }

    // 7.4 DÜŞÜLECEK XP MİKTARI GİRİLDİĞİNDE SUBMIT
    if (customId.startsWith('level_modal_take_xp_amount_')) {
        await interaction.deferUpdate().catch(() => {});
        const targetUserId = customId.replace('level_modal_take_xp_amount_', '');
        const amount = parseInt(interaction.fields.getTextInputValue('take_xp_amount'), 10);

        if (!targetUserId || isNaN(amount) || amount <= 0) {
            const errPayload = createContainerMessage(
                'Geçersiz Girdi',
                'Lütfen pozitif bir XP sayısı giriniz.',
                COLORS.ERROR || '#ED4245'
            );
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!member) {
            const errPayload = createContainerMessage(
                'Kullanıcı Bulunamadı',
                `Sunucuda seçilen üye bulunamadı.`,
                COLORS.ERROR || '#ED4245'
            );
            await interaction.followUp({ ...errPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }

        const userData = await getLevelUser(guildId, targetUserId);
        const oldXP = Number(userData.xp || 0);
        const newXP = Math.max(0, oldXP - amount);

        await setLevelUser(guildId, targetUserId, newXP);

        const successPayload = createContainerMessage(
            'XP Başarıyla Düşürüldü',
            `<@${targetUserId}> kullanıcısından **-${amount} XP** düşürüldü.\nEski XP: **${oldXP}** › Yeni Toplam XP: **${newXP}**`,
            COLORS.WARNING || '#FEE75C'
        );
        await interaction.followUp({ ...successPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        return true;
    }

    // 8. SIFIRLAMA BUTONU
    if (customId === 'level_btn_reset') {
        await interaction.deferUpdate().catch(() => {});
        const desc = [
            `<:mono:${MONO_EMOJIS.warning || '1530917524609175562'}> **Seviye Sıfırlama Merkezi**`,
            `Lütfen yapmak istediğiniz sıfırlama işlemini seçin.`,
            `*Dikkat: Tüm sunucuyu sıfırlama işlemi geri alınamaz!*`
        ].join('\n');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('level_btn_reset_all_confirm')
                .setLabel('Tüm Sunucuyu Sıfırla')
                .setEmoji(MONO_EMOJIS.delete || '1530918957349867711')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('level_btn_back')
                .setLabel('İptal / Geri')
                .setEmoji(MONO_EMOJIS.arrow_left || '1530918962890670161')
                .setStyle(ButtonStyle.Secondary)
        );

        const payload = createContainerMessage(
            'Seviye Verilerini Sıfırla',
            desc,
            COLORS.ERROR || '#ED4245',
            [row]
        );

        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    // 8.1 TÜM SUNUCUYU SIFIRLA ONAY
    if (customId === 'level_btn_reset_all_confirm' || customId === 'level_btn_confirm_reset') {
        await interaction.deferUpdate().catch(() => {});
        await resetGuildLevels(guildId);
        const payload = await buildLevelPanel(guildId);
        await interaction.editReply(payload).catch(() => {});
        
        const notice = createContainerMessage(
            'Sıfırlama Tamamlandı',
            'Bu sunucudaki tüm üyelerin XP ve seviye kayıtları başarıyla sıfırlandı.',
            COLORS.SUCCESS || '#57F287'
        );
        await interaction.followUp({ ...notice, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        return true;
    }

    return false;
}

module.exports = {
    getXPForNextLevel,
    getTotalXPForLevel,
    getLevelFromTotalXP,
    createProgressBar,
    processMessageXP,
    processVoiceXP,
    processInviteXP,
    initVoiceXpEngine,
    buildLevelPanel,
    buildLevelRewardsPanel,
    handleLevelInteraction
};
