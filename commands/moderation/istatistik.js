const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const os = require('os');

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    
    let parts = [];
    if (d > 0) parts.push(`${d} gün`);
    if (h > 0) parts.push(`${h} saat`);
    if (m > 0) parts.push(`${m} dakika`);
    if (s > 0 || parts.length === 0) parts.push(`${s} saniye`);
    return parts.join(' ');
}

async function generateStatsText(client, interaction) {
    const eSet = `<:mono:${MONO_EMOJIS.settings}>`;
    const eStat = `<:mono:${MONO_EMOJIS.status}>`;
    const eShield = `<:mono:${MONO_EMOJIS.shield}>`;
    const eInvite = `<:mono:${MONO_EMOJIS.invite}>`;
    const eAnnounce = `<:mono:${MONO_EMOJIS.announcement}>`;
    const eCrown = `<:mono:${MONO_EMOJIS.crown}>`;
    const eTicket = `<:mono:${MONO_EMOJIS.ticket}>`;
    const ePin = `<:mono:${MONO_EMOJIS.pin}>`;

    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toLocaleString('tr-TR');
    const createdTimestamp = Math.floor(client.user.createdTimestamp / 1000);
    
    const uptimeStr = formatUptime(process.uptime());
    const ping = client.ws.ping;
    
    // CPU usage estimation
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for(let i = 0, len = cpus.length; i < len; i++) {
        let cpu = cpus[i];
        for(type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    }
    const cpuUsage = (100 - ~~(100 * totalIdle / totalTick)).toFixed(1);
    
    const memUsage = process.memoryUsage();
    const ramMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
    const totalMem = os.totalmem();
    const totalMemGB = (totalMem / 1024 / 1024 / 1024).toFixed(1);
    const ramPercent = ((memUsage.heapUsed / totalMem) * 100).toFixed(1);
    
    const cmdsCount = client.commands ? client.commands.size : 0;
    
    const latency = Date.now() - interaction.createdTimestamp;
    const nowStamp = Math.floor(Date.now() / 1000);

    const text = `-# Uygulama Dizini: https://discord.com/application-directory/${client.user.id}
## ${eSet} **${client.user.username}**
> Sunucunu yöneten, topluluğunu canlandıran hepsi bir arada Discord deneyimi.
${eStat} **${totalGuilds} sunucuda ${totalUsers} kullanıcıya hizmet veriyor.**

### ${eSet} **${client.user.username} Ağı**
${eShield} **Sunucu Sayısı:** **${totalGuilds}**
${eInvite} **Hizmet Edilen Kullanıcı:** **${totalUsers}**
${eAnnounce} **Piyasaya Sunuş Tarihi:** <t:${createdTimestamp}:f> (<t:${createdTimestamp}:R>)

### ${eCrown} **Canlı Sistem Durumu**
${eStat} **Kesintisiz Çalışma:** **${uptimeStr}**
${eStat} **Gecikme:** **${ping}ms**
${eStat} **CPU Kullanımı:** **%${cpuUsage}** 
${eTicket} **RAM Kullanımı:** **%${ramPercent}**
${eSet} **Bellek Dağılımı:** **${ramMB} MB / ${totalMemGB} GB**

### ${ePin} **Proje Bilgileri**
${eCrown} **Bot Sahibi:** [**Oxy**](https://discord.com/users/980449798207438908)
${eSet} **Geliştirildiği Altyapı:** [**discord.js v14.27.0**](https://discord.js.org/) \`Özel Fork\` · [**Node.js ${process.version}**](https://nodejs.org/)
${eTicket} **Komutlar:** **${cmdsCount} toplam slash**
${eSet} **Altyapı:** **V2 Container (Stateless)**

-# Sorgulayan: <@${interaction.user.id}> (${latency}ms) · Son Güncelleme: <t:${nowStamp}:f>`;

    return text;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Canlı sistem durumu ve bot istatistiklerini gösterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    generateStatsText,

    async execute(interaction) {
        try { await interaction.deferReply(); } catch(e) { return; }
        
        try {
            const text = await generateStatsText(interaction.client, interaction);
            
            const refreshBtn = new ButtonBuilder()
                .setCustomId('istatistik_refresh')
                .setLabel('Sayfayı Yenile')
                .setEmoji(MONO_EMOJIS.status)
                .setStyle(ButtonStyle.Secondary);
                
            const row = new ActionRowBuilder().addComponents(refreshBtn);
            
            const payload = buildModBResponse({
                textLines: [text],
                actionRows: [row]
            });
            
            await interaction.editReply(payload).catch(()=>{});
        } catch (error) {
            console.error('İstatistik hatası:', error);
            await interaction.editReply({ content: 'İstatistikler alınırken hata oluştu.' }).catch(()=>{});
        }
    }
};
