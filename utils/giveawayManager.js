const { 
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags 
} = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

function buildGiveawayPayload(gw, isEnded = false, winners = []) {
    const totalParts = gw.participants ? gw.participants.length : 0;
    const endsEpoch = Math.floor(gw.ends_at / 1000);

    const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> ÇEKİLİŞ: ${gw.prize}`;
    
    let timeField = `**Bitiş:** <t:${endsEpoch}:R> (<t:${endsEpoch}:f>)`;
    if (isEnded) {
        timeField = `**Bitti:** <t:${endsEpoch}:f>`;
    }

    const lines = [
        `### ${title}`,
        gw.description ? `> ${gw.description}\n` : '',
        timeField,
        `**Düzenleyen:** <@${gw.host_id}>`,
        `**Kazanan Sayısı:** \`${gw.winner_count}\``,
        gw.required_role_id ? `**Zorunlu Rol:** <@&${gw.required_role_id}>` : '',
        `**Katılımcı Sayısı:** \`${totalParts}\``,
        ''
    ].filter(Boolean);

    if (isEnded) {
        if (winners.length > 0) {
            lines.push(`**Kazananlar:** ${winners.map(w => `<@${w}>`).join(', ')}`);
        } else {
            lines.push(`**Kazananlar:** *Yeterli katılımcı bulunamadı.*`);
        }
    }

    const mainContainer = new ContainerBuilder();
    const section = new SectionBuilder();
    section.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n'))
    );
    mainContainer.addSectionComponents(section);

    const components = [mainContainer];

    // Buton Konteyneri
    const buttonContainer = new ContainerBuilder();
    const row = new ActionRowBuilder();

    if (!isEnded && gw.status === 'active') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`gw_join:${gw.message_id}`)
                .setLabel(`Katıl (${totalParts})`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(MONO_EMOJIS.star || '1530917515227725834'),
            new ButtonBuilder()
                .setCustomId(`gw_parts:${gw.message_id}`)
                .setLabel('Katılımcılar')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(MONO_EMOJIS.user || '1537768132062486558')
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`gw_ended:${gw.message_id}`)
                .setLabel(`Çekiliş Sona Erdi (${totalParts} Katılımcı)`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji(MONO_EMOJIS.inactive || '1530917456728559648')
        );
    }

    buttonContainer.addActionRowComponents(row);
    components.push(buttonContainer);

    return {
        flags: MessageFlags.IsComponentsV2,
        components: components
    };
}

async function endGiveaway(messageId, client, isReroll = false, customWinnerCount = null) {
    const gw = await db.getGiveaway(messageId);
    if (!gw) return { error: 'Çekiliş veritabanında bulunamadı.' };
    if (!isReroll && gw.status === 'ended') return { error: 'Bu çekiliş zaten sonlanmış.' };

    const guild = client.guilds.cache.get(gw.guild_id);
    if (!guild) return { error: 'Sunucu bulunamadı.' };

    const channel = guild.channels.cache.get(gw.channel_id);
    if (!channel) return { error: 'Kanal bulunamadı.' };

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

    // Veritabanını güncelle
    await db.setGiveawayWinners(messageId, winners);

    // Çekiliş Mesajını Güncelle
    try {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
            const payload = buildGiveawayPayload(gw, true, winners);
            await msg.edit(payload).catch(() => {});
        }
    } catch (e) {}

    // Kazanan Anons Mesajı Gönder
    if (winners.length > 0) {
        const winnerPings = winners.map(w => `<@${w}>`).join(' ');
        const announceMsg = createContainerMessage(
            `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Kazananları Belirlendi!`,
            `Tebrikler ${winnerPings}!\n**${gw.prize}** ödülünü kazandınız! Ödülünüzü almak için <@${gw.host_id}> ile iletişime geçin.`,
            '#57F287', [], [], false
        );
        await channel.send({ content: `${winnerPings}`, ...announceMsg }).catch(() => {});
    } else {
        const noWinnerMsg = createContainerMessage(
            `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Çekiliş Sona Erdi`,
            `**${gw.prize}** çekilişine yeterli katılım olmadığı için kazanan belirlenemedi.`,
            '#ED4245', [], [], false
        );
        await channel.send(noWinnerMsg).catch(() => {});
    }

    return { success: true, winners };
}

function initGiveawayScheduler(client) {
    setInterval(async () => {
        try {
            const activeList = await db.getActiveGiveaways().catch(() => []);
            const now = Date.now();

            for (const gw of activeList) {
                if (now >= gw.ends_at) {
                    await endGiveaway(gw.message_id, client).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[Giveaway Scheduler Error]:', e);
        }
    }, 10000); // 10 saniyede bir kontrol et
}

async function handleGiveawayButton(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('gw_')) return false;

    const [action, messageId] = customId.split(':');
    const userId = interaction.user.id;

    if (action === 'gw_join') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const gw = await db.getGiveaway(messageId);
        if (!gw || gw.status !== 'active') {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Çekiliş Aktif Değil`,
                'Bu çekiliş sona ermiş veya duraklatılmış.',
                '#ED4245', [], [], false
            ));
        }

        // Zorunlu rol kontrolü
        if (gw.required_role_id) {
            const member = interaction.member;
            if (!member || !member.roles.cache.has(gw.required_role_id)) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Rol Şartı Karşılanmadı`,
                    `Bu çekilişe katılabilmek için <@&${gw.required_role_id}> rolüne sahip olmalısınız!`,
                    '#ED4245', [], [], false
                ));
            }
        }

        const res = await db.toggleGiveawayParticipant(messageId, userId);
        if (!res) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                'Çekilişe katılım işlenirken bir sorun oluştu.',
                '#ED4245', [], [], false
            ));
        }

        // Ana Çekiliş Mesajındaki Buton Sayacını Güncelle
        try {
            const updatedGw = await db.getGiveaway(messageId);
            const payload = buildGiveawayPayload(updatedGw, false);
            await interaction.message.edit(payload).catch(() => {});
        } catch (e) {}

        if (res.joined) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekilişe Katıldınız!`,
                `**${gw.prize}** çekilişine başarıyla dahil oldunuz. Bol şanslar!`,
                '#57F287', [], [], false
            ));
        } else {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Çekilişten Ayrıldınız`,
                `**${gw.prize}** çekilişinden katılımınız silindi.`,
                '#ED4245', [], [], false
            ));
        }
    }

    if (action === 'gw_parts') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const gw = await db.getGiveaway(messageId);
        if (!gw) {
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`,
                'Çekiliş bulunamadı.',
                '#ED4245', [], [], false
            ));
        }

        const parts = gw.participants || [];
        const partsText = parts.length > 0 
            ? parts.slice(0, 30).map((p, idx) => `${idx + 1}. <@${p}>`).join('\n') + (parts.length > 30 ? `\n*...ve ${parts.length - 30} kişi daha*` : '')
            : '*Henüz katılımcı yok.*';

        const title = `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Çekiliş Katılımcıları (${parts.length})`;
        const desc = `**${gw.prize}** çekilişine katılan üyeler:`;
        const fields = [
            { name: 'Katılımcı Listesi', value: partsText, inline: false }
        ];

        return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
    }

    return true;
}

module.exports = {
    buildGiveawayPayload,
    endGiveaway,
    initGiveawayScheduler,
    handleGiveawayButton
};
