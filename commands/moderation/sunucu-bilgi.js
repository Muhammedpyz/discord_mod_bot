const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ChannelType } = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

const VERIFICATION_LEVELS = {
    0: 'Yok (Güvenlik Korumasız)',
    1: 'Düşük (Doğrulanmış E-posta)',
    2: 'Orta (5 Dakikalık Üyelik)',
    3: 'Yüksek (10 Dakikalık Sunucu Üyeliği)',
    4: 'En Yüksek (Doğrulanmış Telefon Numarası)'
};

const NSFW_LEVELS = {
    0: 'Varsayılan',
    1: 'Müstehcen İçerikli (Müstehcen)',
    2: 'Güvenli (Tüm İçerikler Filtrelenir)',
    3: 'Tüm Üyeler İçin Açık'
};

async function buildServerInfoPayload(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);

    const createdStamp = Math.floor(guild.createdTimestamp / 1000);
    const joinedStamp = Math.floor(guild.joinedTimestamp / 1000);

    // Member counts
    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    // Channel counts
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
    const categoryChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const forumChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size;
    const totalChannels = guild.channels.cache.size;

    // Roles & Emojis
    const roleCount = guild.roles.cache.size - 1; // Exclude @everyone
    const staticEmojis = guild.emojis.cache.filter(e => !e.animated).size;
    const animatedEmojis = guild.emojis.cache.filter(e => e.animated).size;
    const stickersCount = guild.stickers.cache.size;

    // Boost Info
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31);

    const header = `## <:mono:${MONO_EMOJIS.server || '1530917511711948903'}> **${guild.name} | Sunucu Bilgileri**\n` +
                   `> Sunucunun genel kimliği, güvenlik seviyesi, üye ve kanal dağılımı.`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const generalInfo =
        `### <:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> **Genel Kimlik & Kuruluş**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Sunucu Sahibi:** ${owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : 'Bilinmiyor'}\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Sunucu ID:** \`${guild.id}\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Kuruluş Tarihi:** <t:${createdStamp}:f> (<t:${createdStamp}:R>)\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Botun Katılışı:** <t:${joinedStamp}:f> (<t:${joinedStamp}:R>)\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Özel URL (Vanity):** \`${guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'Yok'}\`\n\n` +
        `### <:mono:${MONO_EMOJIS.users || '1537768132062486558'}> **Nüfus & Üye Dağılımı**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Toplam Nüfus:** \`${totalMembers}\` üye\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Gerçek Kullanıcılar:** \`${humanCount}\` kişi (\`%${((humanCount/totalMembers)*100).toFixed(0)}\`)\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Bot Sayısı:** \`${botCount}\` bot (\`%${((botCount/totalMembers)*100).toFixed(0)}\`)\n\n` +
        `### <:mono:${MONO_EMOJIS.channel || '1537770137136922694'}> **Kanallar, Roller & İfadeler**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Kanal Dağılımı:** \`${totalChannels}\` toplam (\`${textChannels}\` Metin · \`${voiceChannels}\` Ses · \`${categoryChannels}\` Kategori · \`${forumChannels}\` Forum)\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Rol Sayısı:** \`${roleCount}\` adet rol\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Emojiler:** \`${staticEmojis + animatedEmojis}\` adet (\`${staticEmojis}\` Normal · \`${animatedEmojis}\` Hareketli GIF)\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Çıkartmalar (Sticker):** \`${stickersCount}\` adet\n\n` +
        `### <:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Güvenlik & Takviye (Boost)**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Doğrulama Düzeyi:** \`${VERIFICATION_LEVELS[guild.verificationLevel] || 'Standart'}\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **2FA Yönetici Güvenliği:** \`${guild.mfaLevel === 1 ? 'Aktif (Zorunlu)' : 'Devre Dışı'}\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Takviye Durumu:** \`Seviye ${boostLevel}\` (\`${boostCount}\` Takviye Basılmış)`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(generalInfo));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('server_info_refresh')
            .setLabel('Yenile')
            .setEmoji(MONO_EMOJIS.refresh_cw)
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(row);

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sunucu-bilgi')
        .setDescription('Sunucunun kimlik, güvenlik, kanal, rol, boost ve nüfus bilgilerini görüntüler.'),

    buildServerInfoPayload,

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const payload = await buildServerInfoPayload(interaction);
        return await interaction.editReply(payload);
    }
};
