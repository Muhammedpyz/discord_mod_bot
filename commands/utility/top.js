const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const {
    getTopLevelUsers,
    getTopReputationUsers,
    getLevelConfig,
    getLevelUser,
    getLevelRank
} = require('../../db');
const { getLevelFromTotalXP } = require('../../utils/levelManager');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');

const CATEGORY_NAMES = {
    xp: 'Genel XP & Seviye Sıralaması',
    messages: 'En Çok Mesaj Yazanlar',
    voice: 'En Çok Seste Kalanlar',
    invites: 'En Çok Davet Yapanlar',
    rep: 'En Yüksek İtibar (Reputation)'
};

async function buildTopLeaderboard(guild, category = 'xp', targetUserId = null) {
    const guildId = guild.id;
    const levelCfg = await getLevelConfig(guildId);
    const xpPerLevel = levelCfg.xp_per_level || 500;

    const monoRankBadges = [
        `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}>`,
        `<:mono:${MONO_EMOJIS.medal || '1537767798472704032'}>`,
        `<:mono:${MONO_EMOJIS.award || '1537767883608957048'}>`
    ];

    let lines = [];
    let extraUserText = '';

    if (category === 'rep') {
        const topReps = await getTopReputationUsers(guildId, 10);
        if (!topReps || topReps.length === 0) {
            lines.push('*Henüz itibar (+rep) puanı kazanmış bir üye bulunmuyor.*');
        } else {
            lines = topReps.map((u, index) => {
                const rankLabel = monoRankBadges[index] || `\`#${index + 1}\``;
                return `${rankLabel} <@${u.user_id}> — **${u.rep_count} İtibar Puanı**`;
            });
        }
    } else {
        const topUsers = await getTopLevelUsers(guildId, 10, category);
        if (!topUsers || topUsers.length === 0) {
            lines.push('*Bu sunucuda henüz seviye kasan veya veri kaydedilen bir üye bulunmuyor.*');
        } else {
            lines = topUsers.map((u, index) => {
                const rankLabel = monoRankBadges[index] || `\`#${index + 1}\``;
                const totalXP = Number(u.xp || 0);
                const stats = getLevelFromTotalXP(totalXP, xpPerLevel);
                const voiceHours = (Math.floor(Number(u.voice_secs || 0) / 60) / 60).toFixed(1);

                if (category === 'messages') {
                    return `${rankLabel} <@${u.user_id}> — **${u.messages || 0} Mesaj** (\`${stats.level}. Seviye\` • \`${totalXP} XP\`)`;
                } else if (category === 'voice') {
                    return `${rankLabel} <@${u.user_id}> — **${voiceHours} Saat** (\`${Math.floor(Number(u.voice_secs || 0) / 60)} Dk\` • \`${stats.level}. Seviye\`)`;
                } else if (category === 'invites') {
                    return `${rankLabel} <@${u.user_id}> — **${u.invites || 0} Davet** (\`${stats.level}. Seviye\` • \`${totalXP} XP\`)`;
                } else {
                    return `${rankLabel} <@${u.user_id}> — **${stats.level}. Seviye** (\`${totalXP} XP\` • \`${u.messages || 0} Mesaj\` • \`${voiceHours} Saat\`)`;
                }
            });
        }
    }

    if (targetUserId) {
        const userRank = await getLevelRank(guildId, targetUserId);
        const userData = await getLevelUser(guildId, targetUserId);
        const userStats = getLevelFromTotalXP(Number(userData.xp || 0), xpPerLevel);
        const userVoiceHours = (Math.floor(Number(userData.voice_secs || 0) / 60) / 60).toFixed(1);
        extraUserText = [
            ``,
            `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Sizin Sıralamanız:**`,
            `> • **Sıra:** \`#${userRank}\` | **Seviye:** \`${userStats.level}\` | **XP:** \`${userData.xp || 0}\``,
            `> • **Mesaj:** \`${userData.messages || 0}\` | **Ses:** \`${userVoiceHours} saat\` | **Davet:** \`${userData.invites || 0}\``
        ].join('\n');
    }

    const desc = [
        `**Kategori:** \`${CATEGORY_NAMES[category] || 'Genel Sıralama'}\``,
        `*Aşağıdaki seçim menüsünden listeyi Mesaj, Ses, Davet veya İtibar liderlerine göre filtreleyebilirsiniz.*`,
        ``,
        lines.join('\n'),
        extraUserText
    ].join('\n');

    // Kategori Seçim Menüsü
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('top_select_category')
        .setPlaceholder('Liderlik Kategorisini Seçin')
        .addOptions([
            {
                label: 'Genel XP & Seviye Sıralaması',
                value: 'xp',
                description: 'En yüksek seviyeli ve en çok XP kazanan üyeler',
                default: category === 'xp'
            },
            {
                label: 'En Çok Mesaj Yazanlar',
                value: 'messages',
                description: 'Metin kanallarında en çok mesaj gönderenler',
                default: category === 'messages'
            },
            {
                label: 'En Çok Seste Kalanlar',
                value: 'voice',
                description: 'Ses odalarında en uzun süre aktif kalanlar',
                default: category === 'voice'
            },
            {
                label: 'En Çok Davet Yapanlar',
                value: 'invites',
                description: 'Sunucuya en çok yeni üye kazandıranlar',
                default: category === 'invites'
            },
            {
                label: 'En Yüksek İtibar (Reputation)',
                value: 'rep',
                description: 'Üyelerden en çok +rep takdiri alanlar',
                default: category === 'rep'
            }
        ]);

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`top_btn_myrank:${category}`)
            .setLabel('Benim Sıramı Göster')
            .setEmoji(MONO_EMOJIS.user || '1537768132062486558')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`top_btn_refresh:${category}`)
            .setLabel('Yenile')
            .setEmoji(MONO_EMOJIS.refresh_cw || '1537768206989791232')
            .setStyle(ButtonStyle.Secondary)
    );

    const payload = createContainerMessage(
        `${guild.name} - Liderlik Tablosu`,
        desc,
        COLORS.PRIMARY || '#5865F2',
        [new ActionRowBuilder().addComponents(selectMenu), btnRow]
    );
    payload.flags = MessageFlags.IsComponentsV2;
    return payload;
}

async function handleTopInteraction(interaction, client) {
    if (!interaction.customId.startsWith('top_')) return false;

    await interaction.deferUpdate().catch(() => {});

    let category = 'xp';
    let targetUserId = null;

    if (interaction.customId === 'top_select_category') {
        category = interaction.values[0] || 'xp';
    } else if (interaction.customId.startsWith('top_btn_myrank:')) {
        category = interaction.customId.split(':')[1] || 'xp';
        targetUserId = interaction.user.id;
    } else if (interaction.customId.startsWith('top_btn_refresh:')) {
        category = interaction.customId.split(':')[1] || 'xp';
    }

    const payload = await buildTopLeaderboard(interaction.guild, category, targetUserId);
    await interaction.editReply(payload).catch(() => {});
    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Sunucunun aktiflik, mesaj, ses ve XP liderlik tablosunu gösterir')
        .addStringOption(opt =>
            opt.setName('kategori')
                .setDescription('Görüntülenecek sıralama kategorisi')
                .setRequired(false)
                .addChoices(
                    { name: 'Genel XP & Seviye', value: 'xp' },
                    { name: 'En Çok Mesaj Yazanlar', value: 'messages' },
                    { name: 'En Çok Seste Kalanlar', value: 'voice' },
                    { name: 'En Çok Davet Yapanlar', value: 'invites' },
                    { name: 'En Yüksek İtibar (+Rep)', value: 'rep' }
                )
        )
        .setDMPermission(false),

    execute: async function(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const category = interaction.options.getString('kategori') || 'xp';
        const payload = await buildTopLeaderboard(interaction.guild, category, interaction.user.id);
        await interaction.editReply(payload);
    },

    buildTopLeaderboard,
    handleTopInteraction
};
