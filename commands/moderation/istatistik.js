const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool } = require('../../db');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const systemNode = require('../../utils/systemNode');
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

async function getStatsPage(interaction, pageName, conn) {
    const guild = interaction.guild;
    const client = interaction.client;

    const eArr = `<:mono:${MONO_EMOJIS.chevron_right}>`;
    const eStat = `<:mono:${MONO_EMOJIS.cpu}>`;
    const eCrown = `<:mono:${MONO_EMOJIS.award}>`;
    const eSet = `<:mono:${MONO_EMOJIS.code}>`;
    const eShield = `<:mono:${MONO_EMOJIS.shield_check}>`;
    const eTicket = `<:mono:${MONO_EMOJIS.terminal}>`;
    const eInvite = `<:mono:${MONO_EMOJIS.users}>`;
    const eDb = `<:mono:${MONO_EMOJIS.hard_drive}>`;
    const ePin = `<:mono:${MONO_EMOJIS.server}>`;
    const eAnnounce = `<:mono:${MONO_EMOJIS.bell_ring}>`;

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('stats_menu')
            .setPlaceholder('Görüntülenecek İstatistiği Seçin')
            .addOptions([
                { label: 'Sunucu Genel Röntgeni', description: 'Sunucu, Roller, Emojiler ve Bot Durumu', value: 'page_genel', default: pageName === 'page_genel' },
                { label: 'Üye & Aktivite Analizi', description: 'Üye katılım hızları ve sesli kanal detayları', value: 'page_uye', default: pageName === 'page_uye' },
                { label: 'Ceza ve Bilet Raporu', description: 'Ban, timeout ve açılan taleplerin özeti', value: 'page_ceza', default: pageName === 'page_ceza' },
                { label: 'Davet Laboratuvarı', description: 'En verimli davet linkleri ve istatistikleri', value: 'page_davet', default: pageName === 'page_davet' },
                { label: 'Veritabanı & Sistem', description: 'Kayıtlı sistem verileri ve aktif modüller', value: 'page_sistem', default: pageName === 'page_sistem' }
            ])
    );
    
    const refreshRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('stats_refresh')
            .setLabel('Sayfayı Yenile')
            .setEmoji(MONO_EMOJIS.refresh_cw)
            .setStyle(ButtonStyle.Secondary)
    );

    let description = '';
    let files = [];

    if (pageName === 'page_genel') {
        const totalGuilds = client.guilds.cache.size;
        const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0).toLocaleString('tr-TR');
        const createdTimestamp = Math.floor(client.user.createdTimestamp / 1000);
        
        const uptimeStr = formatUptime(process.uptime());
        const ping = client.ws.ping;
        
        const cpus = os.cpus();
        let totalIdle = 0, totalTick = 0;
        for(let i = 0; i < cpus.length; i++) {
            let cpu = cpus[i];
            for(let type in cpu.times) totalTick += cpu.times[type];
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

        description = `## ${eSet} **${client.user.username}**
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
${eCrown} **Bot Sahibi:** <@651790387198820425>
${eSet} **Geliştirildiği Altyapı:** [**discord.js v14.27.0**](https://discord.js.org/) \`Özel Fork\` · [**Node.js ${process.version}**](https://nodejs.org/)
${eTicket} **Komutlar:** **${cmdsCount} toplam slash**
${eSet} **Altyapı:** **V2 Container (Stateless)**

-# Sorgu: <@${interaction.user.id}> · Yükleme: ${latency}ms · Son Güncelleme: <t:${nowStamp}:R>`;
    }

    if (pageName === 'page_uye') {
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const humans = guild.memberCount - bots;
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const new24h = guild.members.cache.filter(m => m.joinedTimestamp > oneDayAgo).size;
        const new7d = guild.members.cache.filter(m => m.joinedTimestamp > sevenDaysAgo).size;

        let inVoice = 0, selfMuted = 0, selfDeaf = 0, streaming = 0, video = 0;
        guild.channels.cache.filter(c => c.type === 2).forEach(c => {
            inVoice += c.members.size;
            c.members.forEach(m => {
                if (m.voice.selfMute || m.voice.serverMute) selfMuted++;
                if (m.voice.selfDeaf || m.voice.serverDeaf) selfDeaf++;
                if (m.voice.streaming) streaming++;
                if (m.voice.selfVideo) video++;
            });
        });

        description = `### ${eCrown} **Üye Analizi**
${eSet} **Nüfus Dağılımı:**
${eArr} Toplam Nüfus: \`${guild.memberCount}\`
${eArr} Gerçek Kullanıcı: \`${humans}\`
${eArr} Bot Sayısı: \`${bots}\`

${eStat} **Büyüme Hızı (Katılım):**
${eArr} Son 24 Saatte Gelenler: \`${new24h}\` kişi
${eArr} Son 7 Günde Gelenler: \`${new7d}\` kişi

${eSet} **Sesli Kanal Aktivitesi:**
${eArr} Şu An Seste Olanlar: \`${inVoice}\` kişi
${eArr} Mikrofonu Kapalılar (Mute): \`${selfMuted}\` kişi
${eArr} Kulaklığı Kapalılar (Deaf): \`${selfDeaf}\` kişi
${eArr} Yayın Açanlar (Stream): \`${streaming}\` kişi
${eArr} Kamera Açanlar: \`${video}\` kişi`;
    }
    
    if (pageName === 'page_ceza') {
        let bansCount = 0;
        let banListStr = "SUNUCUDAN YASAKLANANLAR LISTESI\n\n";
        try {
            const bans = await guild.bans.fetch();
            bansCount = bans.size;
            if (bans.size > 0) {
                bans.forEach(ban => {
                    banListStr += `Kullanıcı: ${ban.user.tag} (ID: ${ban.user.id}) - Sebep: ${ban.reason || 'Belirtilmedi'}\n`;
                });
                const banAttachment = new AttachmentBuilder(Buffer.from(banListStr, 'utf-8'), { name: 'ban-listesi.txt' });
                files.push(banAttachment);
            }
        } catch(e) {}
        
        const mutedMembers = guild.members.cache.filter(m => m.communicationDisabledUntilTimestamp > Date.now());
        
        let tOpen = 0, tClosed = 0;
        try {
            const ticketRows = await conn.query('SELECT status, COUNT(*) as c FROM tickets WHERE guild_id = ? GROUP BY status', [guild.id]);
            let rows = Array.isArray(ticketRows) ? ticketRows : [];
            if (rows.length > 0 && Array.isArray(rows[0])) rows = rows[0];

            for(const r of rows) {
                if (r.status === 'open') tOpen += Number(r.c || 0);
                if (r.status === 'closed') tClosed += Number(r.c || 0);
            }
        } catch(e) {}
        
        description = `### ${eShield} **Ceza & Bilet Raporu**
${eSet} **Adli Sicil Tablosu:**
${eArr} Kalıcı Yasaklılar (Ban): \`${bansCount}\` kişi
${eArr} Geçici Susturulmuş (Timeout): \`${mutedMembers.size}\` kişi

-*Not: Eğer banlı üye varsa, tüm banlıların listesi bu mesaja .txt olarak eklenmiştir.*

${eTicket} **Destek Talebi (Ticket) Yoğunluğu:**
${eArr} Şu an Aktif (Açık): \`${tOpen}\` bilet
${eArr} Çözülüp Kapatılan: \`${tClosed}\` bilet
${eArr} Toplam Açılan: \`${tOpen + tClosed}\` bilet`;
    }

    if (pageName === 'page_davet') {
        description = `### ${eInvite} **Davet Laboratuvarı**\n${eSet} **En Verimli Davet Linkleri (İlk 5):**\n\n`;
        
        try {
            const inviteRows = await conn.query('SELECT inviter_id, invite_code, COUNT(*) as total, SUM(CASE WHEN has_left = TRUE THEN 1 ELSE 0 END) as left_count FROM invite_tracking WHERE guild_id = ? AND inviter_id != "BİLİNMİYOR" GROUP BY invite_code, inviter_id ORDER BY total DESC LIMIT 5', [guild.id]);
            
            let rows = Array.isArray(inviteRows) ? inviteRows : [];
            if (rows.length > 0 && Array.isArray(rows[0])) rows = rows[0]; 
            rows = rows.filter(r => r.invite_code !== undefined);

            if (rows.length === 0) {
                description += '*Henüz yeterli davet verisi yok.*';
            } else {
                rows.forEach((r, i) => {
                    const code = r.invite_code;
                    const total = Number(r.total || 0);
                    const left = Number(r.left_count || 0);
                    const stayed = total - left;
                    description += `**${i+1}.** <@${r.inviter_id}> — Link: \`discord.gg/${code}\`\n${eArr} Gelen: \`${total}\` | Kalan: \`${stayed}\` | Çıkan: \`${left}\`\n\n`;
                });
            }
        } catch(e) {
            description += '*Veri çekilirken hata oluştu.*';
        }
        description += `\n-*Not: Çıkan sayısı, sadece bot aktifken sunucudan ayrılanları hesaplar.*`;
    }
    
    if (pageName === 'page_sistem') {
        let warnCount = 0;
        let spamCount = 0;
        let tCount = 0;
        try {
            const warnRows = await conn.query('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ?', [guild.id]);
            warnCount = warnRows && warnRows.c ? warnRows.c : (warnRows[0] && warnRows[0].c ? warnRows[0].c : 0);
            
            const spamRows = await conn.query('SELECT COUNT(*) as c FROM moderation_logs WHERE guild_id = ? AND action = "spam"', [guild.id]);
            spamCount = spamRows && spamRows.c ? spamRows.c : (spamRows[0] && spamRows[0].c ? spamRows[0].c : 0);
            
            const tRows = await conn.query('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?', [guild.id]);
            tCount = tRows && tRows.c ? tRows.c : (tRows[0] && tRows[0].c ? tRows[0].c : 0);
        } catch(e) {}
        
        let setupStatus = 'Kapalı';
        try {
            const setupInfo = await require('../../db').getGuildSetup(guild.id);
            if (setupInfo && setupInfo.active_rooms_category_id) setupStatus = 'Aktif (Kurulu)';
        } catch(e) {}

        const cmdCount = client.commands ? client.commands.size : 0;

        description = `### ${eDb} **Sistem ve Veritabanı**
${eSet} **Veritabanı Yükü:**
${eArr} Toplam Kayıtlı Uyarı (Warn): \`${warnCount}\` adet
${eArr} Toplam İşlenmiş Bilet (Ticket): \`${tCount}\` bilet
${eArr} Sistem Tarafından Engellenen Spam: \`${spamCount}\` olay

${eSet} **Modül Durumları:**
${eArr} Yüklü Komut Sayısı: \`${cmdCount}\` Aktif Komut
${eArr} Özel Oda (Private Room) Sistemi: \`${setupStatus}\`

-*Sunucu ayarlarının detaylı yapılandırmasını görmek için \`/ayarlar\` komutunu kullanın.*`;
    }

    const payload = buildModBResponse({
        textLines: [description],
        actionRows: [menuRow, refreshRow]
    });

    if (files.length > 0) {
        payload.files = files;
    }

    return payload;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Sunucunun detaylı röntgenini çeker ve paneli açar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        let conn;
        try {
            try { await interaction.deferReply(); } catch(e) { return; }
            conn = await pool.getConnection();

            let currentPage = 'page_genel';
            const initialPayload = await getStatsPage(interaction, currentPage, conn);
            const msg = await interaction.editReply(initialPayload);

            // Collector for both menu and refresh button
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id && !systemNode.checkSystemNode(i.user.id)) {
                    return i.reply({ content: 'Bu menüyü sadece komutu yazan kullanabilir.', ephemeral: true });
                }

                try { await i.deferUpdate(); } catch(e) { return; }
                
                if (i.customId === 'stats_menu') {
                    currentPage = i.values[0];
                } else if (i.customId === 'stats_refresh') {
                    // Do nothing extra, just fetch the current page again
                }

                let tempConn;
                try {
                    tempConn = await pool.getConnection();
                    const newPayload = await getStatsPage(interaction, currentPage, tempConn);
                    await interaction.editReply(newPayload);
                } catch(e) {
                    console.error('Stats update error', e);
                } finally {
                    if (tempConn) tempConn.release();
                }
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(()=>{});
            });

        } catch (error) {
            console.error('İstatistik hatası:', error);
            await interaction.editReply({ content: 'İstatistikler alınırken hata oluştu.' }).catch(()=>{});
        } finally {
            if (conn) conn.release();
        }
    }
};
