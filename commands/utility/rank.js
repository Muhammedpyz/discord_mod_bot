const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getLevelConfig, getLevelUser, getLevelRank, getLevelRewards } = require('../../db');
const { getLevelFromTotalXP, createProgressBar } = require('../../utils/levelManager');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Kullanıcının seviye kartını ve XP istatistiklerini görüntüler')
        .addUserOption(opt => 
            opt.setName('kullanici')
                .setDescription('Seviyesine bakılacak kullanıcı (Belirtilmezse siz)')
                .setRequired(false)
        )
        .setDMPermission(false),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const targetUser = interaction.options.getUser('kullanici') || interaction.user;
        const guildId = interaction.guildId;

        const levelCfg = await getLevelConfig(guildId);
        const userData = await getLevelUser(guildId, targetUser.id);
        const rankPos = await getLevelRank(guildId, targetUser.id);
        const rewards = await getLevelRewards(guildId);

        const xpPerLevel = levelCfg.xp_per_level || 100;
        const totalXP = Number(userData.xp || 0);
        const stats = getLevelFromTotalXP(totalXP, xpPerLevel);

        const progressBar = createProgressBar(stats.currentProgressXP, stats.nextLevelRequiredXP, 12);
        const percent = Math.min(100, Math.round((stats.currentProgressXP / stats.nextLevelRequiredXP) * 100));

        const voiceMinutes = Math.floor(Number(userData.voice_secs || 0) / 60);
        const voiceHours = (voiceMinutes / 60).toFixed(1);

        // Sonraki ödül rolünü bul
        const nextReward = rewards.find(r => r.level > stats.level);
        const nextRewardText = nextReward ? `<@&${nextReward.role_id}> (${nextReward.level}. Seviye)` : '`Maksimum Seviye / Yok`';

        const desc = [
            `**Kullanıcı:** <@${targetUser.id}> (\`${targetUser.username}\`)`,
            `**Sıralama:** \`#${rankPos}\` | **Seviye:** \`${stats.level}\``,
            ``,
            `<:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> **Seviye İlerlemesi:**`,
            `> \`${progressBar}\` **%${percent}**`,
            `> • **Mevcut Seviye İlerlemesi:** \`${stats.currentProgressXP} / ${stats.nextLevelRequiredXP} XP\``,
            `> • **Toplam Kazanılan XP:** \`${totalXP} XP\``,
            ``,
            `<:mono:${MONO_EMOJIS.status || '1530917510189285528'}> **Aktivite İstatistikleri:**`,
            `> • **Toplam Mesaj:** \`${userData.messages || 0} mesaj\``,
            `> • **Seste Kalma Süresi:** \`${voiceHours} saat (${voiceMinutes} dk)\``,
            `> • **Başarılı Davetler:** \`${userData.invites || 0} davet\``,
            `> • **Sıradaki Rol Ödülü:** ${nextRewardText}`
        ].join('\n');

        const payload = createContainerMessage(
            `${targetUser.displayName || targetUser.username} - Seviye Kartı`,
            desc,
            COLORS.PRIMARY || '#5865F2'
        );
        payload.flags = MessageFlags.IsComponentsV2;

        await interaction.editReply(payload);
    }
};
