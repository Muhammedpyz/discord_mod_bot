const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

const state = new Map();

const LINK_REGEX = /(https?:\/\/|discord\.gg\/|dsc\.gg\/)/i;
const DAY14 = 14 * 24 * 60 * 60 * 1000;

async function scanChannel(channel) {
    let messages;
    try {
        messages = await channel.messages.fetch({ limit: 100 });
    } catch (e) {
        return null;
    }
    const list = [...messages.values()];
    const now = Date.now();
    const stats = {
        toplam: list.length,
        bot: 0,
        insan: 0,
        link: 0,
        ek: 0,
        silinebilir: 0
    };
    for (const m of list) {
        if (now - m.createdTimestamp <= DAY14) stats.silinebilir++;
        if (m.author.bot) stats.bot++;
        else stats.insan++;
        if (LINK_REGEX.test(m.content || '')) stats.link++;
        if (m.attachments.size > 0) stats.ek++;
    }
    return stats;
}

function filterMessages(messages, kind) {
    return [...messages.values()].filter(m => {
        switch (kind) {
            case 'links': return LINK_REGEX.test(m.content || '');
            case 'bots': return m.author.bot;
            case 'users': return !m.author.bot;
            case 'files': return m.attachments.size > 0;
            default: return true;
        }
    });
}

async function buildPurgePanel(guild, channelId) {
    const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.brush}> Mesaj Temizleme Paneli`)
    );

    const channel = channelId ? guild.channels.cache.get(channelId) : null;

    if (!channel) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Temizlemek istediğin kanalı seç. Kanal seçilince o kanalın mesaj istatistikleri burada gösterilecek.')
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const select = new StringSelectMenuBuilder()
            .setCustomId('purge_select')
            .setPlaceholder('Kanal Seç...')
            .setMinValues(1)
            .setMaxValues(1);
        const textChannels = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
            .sort((a, b) => a.position - b.position);
        textChannels.first(25).forEach(c => select.addOptions({
            label: `#${c.name}`,
            value: c.id
        }));

        container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    const stats = await scanChannel(channel);
    if (!stats) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Mesajlar okunamadı. Botun kanalı görüntüleme yetkisi var mı kontrol et.`)
        );
        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    const info =
        `**Kanal:** <#${channel.id}>\n` +
        `**Son 100 mesajda:**\n` +
        `- Toplam › \`${stats.toplam}\`\n` +
        `- Silinebilir (14 gün içinde) › \`${stats.silinebilir}\`\n` +
        `- Bot mesajı › \`${stats.bot}\`\n` +
        `- Kullanıcı mesajı › \`${stats.insan}\`\n` +
        `- Link içeren › \`${stats.link}\`\n` +
        `- Ek (dosya) içeren › \`${stats.ek}\``;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(info));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Aşağıdaki butonlarla o kanaldaki son 100 mesajı filtreleyerek silebilirsin. Discord yalnızca son 14 günün mesajlarını toplu silebilir.')
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('purge_do:links').setLabel('Linkleri Sil').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.link_2),
        new ButtonBuilder().setCustomId('purge_do:bots').setLabel('Bot Mesajlarını Sil').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.bug_play),
        new ButtonBuilder().setCustomId('purge_do:files').setLabel('Eklileri Sil').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.image)
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('purge_do:users').setLabel('Kullanıcı Mesajlarını Sil').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.users || '1537768079898050681'),
        new ButtonBuilder().setCustomId('purge_do:all').setLabel('Tümünü Sil').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete),
        new ButtonBuilder().setCustomId('purge_change').setLabel('Kanal Değiştir').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw)
    ));

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function handlePurgeInteraction(interaction) {
    if (!interaction.customId?.startsWith('purge_')) return false;

    if (interaction.isStringSelectMenu() && interaction.customId === 'purge_select') {
        await interaction.deferUpdate().catch(() => {});
        const channelId = interaction.values[0];
        state.set(interaction.user.id, channelId);
        const panel = await buildPurgePanel(interaction.guild, channelId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (!interaction.isButton()) return false;

    if (interaction.customId === 'purge_change') {
        await interaction.deferUpdate().catch(() => {});
        state.delete(interaction.user.id);
        const panel = await buildPurgePanel(interaction.guild, null);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    if (interaction.customId.startsWith('purge_do:')) {
        const kind = interaction.customId.split(':')[1];
        const channelId = state.get(interaction.user.id);
        if (!channelId) {
            await interaction.deferUpdate().catch(() => {});
            const panel = await buildPurgePanel(interaction.guild, null);
            panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.editReply(panel);
            return true;
        }
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) return true;

        await interaction.deferUpdate().catch(() => {});

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages || messages.size === 0) {
            const panel = await buildPurgePanel(interaction.guild, channelId);
            panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.editReply(panel);
            return true;
        }

        const targets = filterMessages(messages, kind);
        let deleted = 0;
        if (targets.length > 0) {
            deleted = await channel.bulkDelete(targets, true).then(r => r.size).catch(async () => {
                let n = 0;
                for (const m of targets) {
                    if (await m.delete().then(() => true).catch(() => false)) n++;
                }
                return n;
            });
        }

        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### <:mono:${MONO_EMOJIS.delete}> Silme Tamamlandı`)
        );
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${deleted} mesaj silindi. Güncel istatistikler için aşağıdaki butonu kullan.`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('purge_refresh').setLabel('İstatistikleri Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw)
        ));

        await interaction.editReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: [container] });
        return true;
    }

    if (interaction.customId === 'purge_refresh') {
        await interaction.deferUpdate().catch(() => {});
        const channelId = state.get(interaction.user.id);
        const panel = await buildPurgePanel(interaction.guild, channelId);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
        return true;
    }

    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Mesajları filtreleyerek toplu şekilde siler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        const panel = await buildPurgePanel(interaction.guild, null);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
    },
    handlePurgeInteraction,
    buildPurgePanel
};