const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { pool } = require('../../db');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

function createStatsMenu(selected = 'activity') {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('server_stats_menu')
            .setPlaceholder('Görüntülenecek İstatistik Sayfası...')
            .addOptions([
                { label: 'Üye & Ses Aktivitesi', value: 'stats_activity', description: 'Sunucu büyüme hızı ve canlı ses durumu', default: selected === 'activity' },
                { label: 'Ceza & Bilet Yoğunluğu', value: 'stats_moderation', description: 'Ban, susturma ve destek talepleri hacmi', default: selected === 'moderation' },
                { label: 'Davet Performansı', value: 'stats_invites', description: 'En çok üye getiren davet bağlantıları', default: selected === 'invites' }
            ])
    );
}

async function buildStatsPayload(guild, page = 'activity') {
    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31);

    const navRow = createStatsMenu(page);

    if (page === 'activity') {
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const new24h = guild.members.cache.filter(m => m.joinedTimestamp > oneDayAgo).size;
        const new7d = guild.members.cache.filter(m => m.joinedTimestamp > sevenDaysAgo).size;

        let inVoice = 0, selfMuted = 0, selfDeaf = 0, streaming = 0, video = 0;
        guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).forEach(c => {
            inVoice += c.members.size;
            c.members.forEach(m => {
                if (m.voice.selfMute || m.voice.serverMute) selfMuted++;
                if (m.voice.selfDeaf || m.voice.serverDeaf) selfDeaf++;
                if (m.voice.streaming) streaming++;
                if (m.voice.selfVideo) video++;
            });
        });

        const title = `## <:mono:${MONO_EMOJIS.users || '1537768132062486558'}> **${guild.name} | Üye & Ses Aktivitesi**\n` +
                      `> Sunucunun canlı nüfus grafiği, büyüme hızı ve anlık ses odaları kullanımı.`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const content =
            `### <:mono:${MONO_EMOJIS.trending_up || MONO_EMOJIS.gauge}> **Sunucu Büyüme Hızı**\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Toplam Nüfus:** \`${totalMembers}\` üye (\`${humanCount}\` İnsan · \`${botCount}\` Bot)\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Son 24 Saatte Katılanlar:** \`${new24h}\` yeni üye\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Son 7 Günde Katılanlar:** \`${new7d}\` yeni üye\n\n` +
            `### <:mono:${MONO_EMOJIS.volume_2 || '1537768210772795452'}> **Canlı Ses Odaları Durumu**\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Şu An Seste Olanlar:** \`${inVoice}\` kişi\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Mikrofonu Kapalılar (Mute):** \`${selfMuted}\` kişi\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Kulaklığı Kapalılar (Deaf):** \`${selfDeaf}\` kişi\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Ekran Paylaşımı (Yayın):** \`${streaming}\` kişi\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Kamera Açanlar:** \`${video}\` kişi\n\n` +
            `- # Son Güncelleme: <t:${Math.floor(Date.now() / 1000)}:R>`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }

    if (page === 'moderation') {
        let bansCount = 0;
        try {
            const bans = await guild.bans.fetch().catch(() => null);
            if (bans) bansCount = bans.size;
        } catch (e) {}

        const mutedMembers = guild.members.cache.filter(m => m.communicationDisabledUntilTimestamp > Date.now()).size;

        let tOpen = 0, tClosed = 0, totalWarns = 0;
        try {
            const conn = await pool.getConnection();
            const [ticketRows, warnRows] = await Promise.all([
                conn.query('SELECT status, COUNT(*) as c FROM tickets WHERE guild_id = ? GROUP BY status', [guild.id]),
                conn.query('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ?', [guild.id])
            ]);
            conn.release();

            for (const r of ticketRows) {
                if (r.status === 'open') tOpen += Number(r.c || 0);
                if (r.status === 'closed') tClosed += Number(r.c || 0);
            }
            if (warnRows && warnRows[0]) totalWarns = Number(warnRows[0].c || 0);
        } catch (e) {}

        const title = `## <:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **${guild.name} | Ceza & Destek Yoğunluğu**\n` +
                      `> Sunucuda uygulanan moderasyon cezaları ve bilet (ticket) işlem hacmi.`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const content =
            `### <:mono:${MONO_EMOJIS.gavel || MONO_EMOJIS.shield_alert || '1530917506867400775'}> **Moderasyon & Ceza Kayıtları**\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Kalıcı Yasaklılar (Ban):** \`${bansCount}\` kişi\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Geçici Susturulmuş (Timeout):** \`${mutedMembers}\` kişi\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Toplam Verilmiş Uyarı (Warn):** \`${totalWarns}\` adet\n\n` +
            `### <:mono:${MONO_EMOJIS.ticket || '1530917517227331584'}> **Destek Talebi (Ticket) Hacmi**\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Şu An Açık Biletler:** \`${tOpen}\` adet\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Çözülüp Kapatılan:** \`${tClosed}\` adet\n` +
            `<:mono:${MONO_EMOJIS.chevron_right}> **Toplam İşlenmiş Destek:** \`${tOpen + tClosed}\` adet\n\n` +
            `- # Son Güncelleme: <t:${Math.floor(Date.now() / 1000)}:R>`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }

    if (page === 'invites') {
        let inviteListText = '';
        try {
            const conn = await pool.getConnection();
            const rows = await conn.query(
                'SELECT inviter_id, invite_code, COUNT(*) as total, SUM(CASE WHEN has_left = TRUE THEN 1 ELSE 0 END) as left_count FROM invite_tracking WHERE guild_id = ? AND inviter_id != "BİLİNMİYOR" GROUP BY invite_code, inviter_id ORDER BY total DESC LIMIT 5',
                [guild.id]
            );
            conn.release();

            if (rows.length === 0) {
                inviteListText = `*Henüz yeterli davet verisi kaydedilmedi.*`;
            } else {
                inviteListText = rows.map((r, i) => {
                    const total = Number(r.total || 0);
                    const left = Number(r.left_count || 0);
                    const stayed = total - left;
                    return `**${i + 1}.** <@${r.inviter_id}> — \`discord.gg/${r.invite_code}\`\n` +
                           `<:mono:${MONO_EMOJIS.chevron_right}> Gelen: \`${total}\` · Kalan: \`${stayed}\` · Çıkan: \`${left}\``;
                }).join('\n\n');
            }
        } catch (e) {
            inviteListText = `*Davet verileri yüklenirken hata oluştu.*`;
        }

        const title = `## <:mono:${MONO_EMOJIS.invite || '1530917543491932196'}> **${guild.name} | Davet Performansı**\n` +
                      `> Sunucuya en çok gerçek üye kazandıran davet bağlantıları ve istatistikleri.`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const content =
            `### <:mono:${MONO_EMOJIS.award || '1530918952711094272'}> **En Verimli Davet Linkleri (İlk 5)**\n` +
            `${inviteListText}\n\n` +
            `- # Son Güncelleme: <t:${Math.floor(Date.now() / 1000)}:R>`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }

    container.addActionRowComponents(navRow);

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Sunucunun canlı üye büyümesi, ses odaları kullanımı ve moderasyon yoğunluğunu analiz eder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    buildStatsPayload,

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const payload = await buildStatsPayload(interaction.guild, 'activity');
        return await interaction.editReply(payload);
    }
};
