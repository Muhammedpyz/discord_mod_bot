const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const {
    getUserDailyQuests,
    incrementDailyQuestProgress,
    claimDailyQuest,
    addLevelUserXP
} = require('../db');
const { createProgressBar, checkAndApplyLevelUp } = require('./levelManager');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('./uiBuilder');

function getTodayDateStr() {
    const now = new Date();
    // Türkiye saat dilimi (UTC+3)
    const trDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
    return trDate; // YYYY-MM-DD
}

function getDailySeed(userId, dateStr) {
    let hash = 0;
    const str = `${userId}_${dateStr}_nyx_proc_quests_v2`;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getDailyUserQuests(userId, dateStr) {
    const seed = getDailySeed(userId, dateStr);

    // 1. Dinamik Mesaj Görevi: 20 ile 120 arası mesaj
    const msgTarget = 20 + ((seed % 21) * 5); // 20, 25, 30 ... 120
    const msgDifficulty = msgTarget <= 40 ? 'Kolay' : msgTarget <= 80 ? 'Orta' : 'Zor';
    const msgReward = msgTarget * 8; // 160 XP - 960 XP

    // 2. Dinamik Ses Görevi: 20 ile 90 arası dakika
    const voiceTarget = 20 + (((seed >> 3) % 15) * 5); // 20, 25 ... 90
    const voiceDifficulty = voiceTarget <= 35 ? 'Kolay' : voiceTarget <= 60 ? 'Orta' : 'Zor';
    const voiceReward = voiceTarget * 7; // 140 XP - 630 XP

    // 3. Dinamik Topluluk Öneri Görevi: 1 ile 2 öneri
    const sugTarget = 1 + (((seed >> 7) % 2)); // 1 veya 2
    const sugDifficulty = sugTarget === 1 ? 'Kolay' : 'Orta';
    const sugReward = sugTarget * 180; // 180 XP veya 360 XP

    return {
        msg: {
            id: 'msg',
            target: msgTarget,
            rewardXP: msgReward,
            difficulty: msgDifficulty,
            title: `Sohbet Ustası (${msgTarget} Mesaj)`,
            description: `Genel sohbet kanallarında ${msgTarget} mesaj yazarak toplulukla kaynaş.`,
            emojiKey: 'message_circle'
        },
        voice: {
            id: 'voice',
            target: voiceTarget,
            rewardXP: voiceReward,
            difficulty: voiceDifficulty,
            title: `Sesli Muhabbet (${voiceTarget} Dakika)`,
            description: `Ses odalarında aktif olarak ${voiceTarget} dakika vakit geçir.`,
            emojiKey: 'volume'
        },
        suggestion: {
            id: 'suggestion',
            target: sugTarget,
            rewardXP: sugReward,
            difficulty: sugDifficulty,
            title: `Topluluk Fikri (${sugTarget} Öneri)`,
            description: `Sunucu gelişimi için #istek-öneri kanalına ${sugTarget} yaratıcı fikir bırak.`,
            emojiKey: 'wand_sparkles'
        }
    };
}

async function trackMessageQuest(message) {
    if (!message || message.author.bot || !message.guild) return;
    const dateStr = getTodayDateStr();
    await incrementDailyQuestProgress(message.guild.id, message.author.id, dateStr, 'message', 1).catch(() => {});
}

async function trackVoiceQuest(guildId, userId, minutes = 1) {
    if (!guildId || !userId) return;
    const dateStr = getTodayDateStr();
    await incrementDailyQuestProgress(guildId, userId, dateStr, 'voice', minutes).catch(() => {});
}

async function trackSuggestionQuest(guildId, userId) {
    if (!guildId || !userId) return;
    const dateStr = getTodayDateStr();
    await incrementDailyQuestProgress(guildId, userId, dateStr, 'suggestion', 1).catch(() => {});
}

async function buildDailyQuestPanel(guildId, userId, memberName = 'Kullanıcı') {
    const dateStr = getTodayDateStr();
    const questData = await getUserDailyQuests(guildId, userId, dateStr);
    const userQuests = getDailyUserQuests(userId, dateStr);

    const msgProgress = Math.min(userQuests.msg.target, questData.messages_count || 0);
    const voiceProgress = Math.min(userQuests.voice.target, questData.voice_minutes || 0);
    const sugProgress = Math.min(userQuests.suggestion.target, questData.suggestions_count || 0);

    const msgDone = msgProgress >= userQuests.msg.target;
    const voiceDone = voiceProgress >= userQuests.voice.target;
    const sugDone = sugProgress >= userQuests.suggestion.target;

    const msgClaimed = Boolean(questData.claimed_msg);
    const voiceClaimed = Boolean(questData.claimed_voice);
    const sugClaimed = Boolean(questData.claimed_sug);

    const msgBar = createProgressBar(msgProgress, userQuests.msg.target, 10);
    const voiceBar = createProgressBar(voiceProgress, userQuests.voice.target, 10);
    const sugBar = createProgressBar(sugProgress, userQuests.suggestion.target, 10);

    const msgPercent = Math.min(100, Math.round((msgProgress / userQuests.msg.target) * 100));
    const voicePercent = Math.min(100, Math.round((voiceProgress / userQuests.voice.target) * 100));
    const sugPercent = Math.min(100, Math.round((sugProgress / userQuests.suggestion.target) * 100));

    function getStatusBadge(done, claimed) {
        if (claimed) return '`[ÖDÜL ALINDI]`';
        if (done) return '`[TAMAMLANDI - ÖDÜLÜ AL]`';
        return '`[DEVAM EDİYOR]`';
    }

    const desc = [
        `**Bugünün Tarihi:** \`${dateStr}\` | **Kullanıcı:** <@${userId}>`,
        `*Günlük görevler her gece **00:00**'da kişiye özel rastgele hedeflerle yenilenir. Tamamladığınız görevlerin ödüllerini aşağıdaki butonlarla toplayabilirsiniz.*`,
        ``,
        `<:mono:${MONO_EMOJIS[userQuests.msg.emojiKey] || '1537768113221799957'}> **1. ${userQuests.msg.title}** › \`+${userQuests.msg.rewardXP} XP\` *(${userQuests.msg.difficulty})*`,
        `> ${userQuests.msg.description}`,
        `> \`${msgBar}\` **%${msgPercent}** (\`${msgProgress}/${userQuests.msg.target}\`) ${getStatusBadge(msgDone, msgClaimed)}`,
        ``,
        `<:mono:${MONO_EMOJIS[userQuests.voice.emojiKey] || '1537768157110992997'}> **2. ${userQuests.voice.title}** › \`+${userQuests.voice.rewardXP} XP\` *(${userQuests.voice.difficulty})*`,
        `> ${userQuests.voice.description}`,
        `> \`${voiceBar}\` **%${voicePercent}** (\`${voiceProgress}/${userQuests.voice.target} dk\`) ${getStatusBadge(voiceDone, voiceClaimed)}`,
        ``,
        `<:mono:${MONO_EMOJIS[userQuests.suggestion.emojiKey] || '1537767764918538371'}> **3. ${userQuests.suggestion.title}** › \`+${userQuests.suggestion.rewardXP} XP\` *(${userQuests.suggestion.difficulty})*`,
        `> ${userQuests.suggestion.description}`,
        `> \`${sugBar}\` **%${sugPercent}** (\`${sugProgress}/${userQuests.suggestion.target}\`) ${getStatusBadge(sugDone, sugClaimed)}`
    ].join('\n');

    // Butonlar
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quest_claim_msg')
            .setLabel(`Mesaj (+${userQuests.msg.rewardXP} XP)`)
            .setEmoji(MONO_EMOJIS.check || '1530917534885478600')
            .setStyle(msgClaimed ? ButtonStyle.Secondary : msgDone ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!msgDone || msgClaimed),
        new ButtonBuilder()
            .setCustomId('quest_claim_voice')
            .setLabel(`Ses (+${userQuests.voice.rewardXP} XP)`)
            .setEmoji(MONO_EMOJIS.check || '1530917534885478600')
            .setStyle(voiceClaimed ? ButtonStyle.Secondary : voiceDone ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!voiceDone || voiceClaimed),
        new ButtonBuilder()
            .setCustomId('quest_claim_sug')
            .setLabel(`Öneri (+${userQuests.suggestion.rewardXP} XP)`)
            .setEmoji(MONO_EMOJIS.check || '1530917534885478600')
            .setStyle(sugClaimed ? ButtonStyle.Secondary : sugDone ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!sugDone || sugClaimed)
    );

    const hasAnyUnclaimed = (msgDone && !msgClaimed) || (voiceDone && !voiceClaimed) || (sugDone && !sugClaimed);

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quest_claim_all')
            .setLabel('Tüm Ödülleri Al')
            .setEmoji(MONO_EMOJIS.gift || '1537767784694423602')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasAnyUnclaimed),
        new ButtonBuilder()
            .setCustomId('quest_refresh')
            .setLabel('Yenile')
            .setEmoji(MONO_EMOJIS.refresh_cw || '1537768206989791232')
            .setStyle(ButtonStyle.Secondary)
    );

    const payload = createContainerMessage(
        'Minecraft Günlük Görevler',
        desc,
        COLORS.PRIMARY || '#5865F2',
        [row1, row2]
    );
    payload.flags = MessageFlags.IsComponentsV2;
    return payload;
}

async function handleQuestInteraction(interaction, client) {
    if (!interaction.customId.startsWith('quest_')) return false;

    await interaction.deferUpdate().catch(() => {});

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const dateStr = getTodayDateStr();
    const questData = await getUserDailyQuests(guildId, userId, dateStr);
    const userQuests = getDailyUserQuests(userId, dateStr);

    let totalClaimedXP = 0;
    const action = interaction.customId;

    if (action === 'quest_claim_msg') {
        const msgProgress = questData.messages_count || 0;
        if (msgProgress >= userQuests.msg.target && !questData.claimed_msg) {
            await claimDailyQuest(guildId, userId, dateStr, 'msg');
            await addLevelUserXP(guildId, userId, userQuests.msg.rewardXP);
            totalClaimedXP += userQuests.msg.rewardXP;
        }
    } else if (action === 'quest_claim_voice') {
        const voiceProgress = questData.voice_minutes || 0;
        if (voiceProgress >= userQuests.voice.target && !questData.claimed_voice) {
            await claimDailyQuest(guildId, userId, dateStr, 'voice');
            await addLevelUserXP(guildId, userId, userQuests.voice.rewardXP);
            totalClaimedXP += userQuests.voice.rewardXP;
        }
    } else if (action === 'quest_claim_sug') {
        const sugProgress = questData.suggestions_count || 0;
        if (sugProgress >= userQuests.suggestion.target && !questData.claimed_sug) {
            await claimDailyQuest(guildId, userId, dateStr, 'suggestion');
            await addLevelUserXP(guildId, userId, userQuests.suggestion.rewardXP);
            totalClaimedXP += userQuests.suggestion.rewardXP;
        }
    } else if (action === 'quest_claim_all') {
        if ((questData.messages_count || 0) >= userQuests.msg.target && !questData.claimed_msg) {
            await claimDailyQuest(guildId, userId, dateStr, 'msg');
            await addLevelUserXP(guildId, userId, userQuests.msg.rewardXP);
            totalClaimedXP += userQuests.msg.rewardXP;
        }
        if ((questData.voice_minutes || 0) >= userQuests.voice.target && !questData.claimed_voice) {
            await claimDailyQuest(guildId, userId, dateStr, 'voice');
            await addLevelUserXP(guildId, userId, userQuests.voice.rewardXP);
            totalClaimedXP += userQuests.voice.rewardXP;
        }
        if ((questData.suggestions_count || 0) >= userQuests.suggestion.target && !questData.claimed_sug) {
            await claimDailyQuest(guildId, userId, dateStr, 'suggestion');
            await addLevelUserXP(guildId, userId, userQuests.suggestion.rewardXP);
            totalClaimedXP += userQuests.suggestion.rewardXP;
        }
    }

    if (totalClaimedXP > 0) {
        if (interaction.guild) {
            await checkAndApplyLevelUp(interaction.guild, userId, client).catch(() => {});
        }
    }

    const payload = await buildDailyQuestPanel(guildId, userId, interaction.user.displayName || interaction.user.username);
    await interaction.editReply(payload).catch(() => {});
    return true;
}

module.exports = {
    getTodayDateStr,
    getDailyUserQuests,
    trackMessageQuest,
    trackVoiceQuest,
    trackSuggestionQuest,
    buildDailyQuestPanel,
    handleQuestInteraction
};
