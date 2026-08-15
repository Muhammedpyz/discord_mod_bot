const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const os = require('os');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    let parts = [];
    if (d > 0) parts.push(`${d} gün`);
    if (h > 0) parts.push(`${h} saat`);
    if (m > 0) parts.push(`${m} dk`);
    if (s > 0 || parts.length === 0) parts.push(`${s} sn`);
    return parts.join(' ');
}

async function buildBotInfoPayload(interaction, client) {
    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0).toLocaleString('tr-TR');
    const createdTimestamp = Math.floor(client.user.createdTimestamp / 1000);
    const uptimeStr = formatUptime(process.uptime());
    const ping = client.ws.ping;

    // CPU Calculation
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (let i = 0; i < cpus.length; i++) {
        let cpu = cpus[i];
        for (let type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
    }
    const cpuUsage = (100 - ~~(100 * totalIdle / totalTick)).toFixed(1);
    const cpuModel = cpus[0]?.model || 'Bilinmiyor';

    // Memory Calculation
    const memUsage = process.memoryUsage();
    const ramMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
    const totalMem = os.totalmem();
    const totalMemGB = (totalMem / 1024 / 1024 / 1024).toFixed(1);
    const ramPercent = ((memUsage.heapUsed / totalMem) * 100).toFixed(1);
    const cmdCount = client.commands ? client.commands.size : 47;

    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2);

    const header = `## <:mono:${MONO_EMOJIS.bot || MONO_EMOJIS.cpu}> **${client.user.username} | Sistem Bilgisi & Durum**\n` +
                   `> Turklion Altyapısı ile çalışan yeni nesil Discord güvenlik ve moderasyon botu.`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const statsText =
        `### <:mono:${MONO_EMOJIS.server}> **Ağ & Hizmet Kapsamı**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Sunucu Sayısı:** \`${totalGuilds}\` sunucu\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Hizmet Edilen Kullanıcı:** \`${totalUsers}\` kişi\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Toplam Slash Komut:** \`${cmdCount}\` aktif komut\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Piyasaya Çıkış:** <t:${createdTimestamp}:f> (<t:${createdTimestamp}:R>)\n\n` +
        `### <:mono:${MONO_EMOJIS.gauge}> **Canlı Donanım & Performans**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Uptime (Çalışma Süresi):** \`${uptimeStr}\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Canlı Gateway Pingi:** \`${ping} ms\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **İşlemci (CPU):** \`%${cpuUsage}\` (${cpuModel})\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Bellek (RAM):** \`${ramMB} MB / ${totalMemGB} GB\` (\`%${ramPercent}\`)\n\n` +
        `### <:mono:${MONO_EMOJIS.code}> **Yazılım & Mimari Detayları**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Bot Sahibi:** <@651790387198820425>\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Node.js Sürümü:** \`${process.version}\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Discord.js Sürümü:** \`v14.27.0 (Components V2 Destekli)\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Veritabanı:** \`MariaDB Relational (Havuzlu Önbellek)\``;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statsText));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bot_info_refresh')
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
        .setName('bot-bilgi')
        .setDescription('Botun donanım, çalışma süresi, kullanıcı ve altyapı bilgilerini görüntüler.'),

    buildBotInfoPayload,

    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const payload = await buildBotInfoPayload(interaction, client);
        return await interaction.editReply(payload);
    }
};
