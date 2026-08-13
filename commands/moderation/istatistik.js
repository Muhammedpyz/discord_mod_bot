const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, AttachmentBuilder } = require('discord.js');
const { pool } = require('../../db');
const { buildModAPanel, MONO_EMOJIS } = require('../../utils/uiBuilder');
const systemNode = require('../../utils/systemNode');

async function getStatsPage(interaction, pageName, conn) {
    const guild = interaction.guild;
    const client = interaction.client;

    const eArr = `<:mono:${MONO_EMOJIS.arrow_right}>`;
    const eStat = `<:mono:${MONO_EMOJIS.status}>`;
    const eCrown = `<:mono:${MONO_EMOJIS.crown}>`;
    const eSet = `<:mono:${MONO_EMOJIS.settings}>`;
    const eShield = `<:mono:${MONO_EMOJIS.shield}>`;
    const eTicket = `<:mono:${MONO_EMOJIS.ticket}>`;
    const eInvite = `<:mono:${MONO_EMOJIS.invite}>`;
    const eDb = `<:mono:${MONO_EMOJIS.check}>`;

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

    let title = '';
    let description = '';
    let files = [];

    if (pageName === 'page_genel') {
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const rolesCount = guild.roles.cache.size;
        const emojisCount = guild.emojis.cache.size;
        const animatedEmojis = guild.emojis.cache.filter(e => e.animated).size;
        const stickersCount = guild.stickers.cache.size;
        const createdAt = Math.floor(guild.createdTimestamp / 1000);
        
        let uptimeStr = '';
        const up = Math.floor(process.uptime());
        if (up > 86400) uptimeStr = `${Math.floor(up/86400)} gün ${Math.floor((up%86400)/3600)} saat`;
        else if (up > 3600) uptimeStr = `${Math.floor(up/3600)} saat ${Math.floor((up%3600)/60)} dk`;
        else uptimeStr = `${Math.floor(up/60)} dk`;

        const ram = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        let verLevel = 'Yok';
        if (guild.verificationLevel === 1) verLevel = 'Düşük';
        if (guild.verificationLevel === 2) verLevel = 'Orta';
        if (guild.verificationLevel === 3) verLevel = 'Yüksek';
        if (guild.verificationLevel === 4) verLevel = 'En Yüksek';

        title = 'Sunucu İstatistikleri | Genel Röntgen';
        description = `${eStat} **Bot Çekirdeği:**\n${eArr} RAM Tüketimi: \`${ram} MB\`\n${eArr} Çalışma Süresi: \`${uptimeStr}\`\n${eArr} Gecikme (Ping): \`${client.ws.ping}ms\`\n${eArr} Altyapı: Node \`${process.version}\` / D.js \`v14.27\`\n\n${eCrown} **Sunucu Profili:**\n${eArr} Kuruluş: <t:${createdAt}:D> (<t:${createdAt}:R>)\n${eArr} Sunucu Sahibi: <@${guild.ownerId}>\n${eArr} Takviye: Seviye \`${guild.premiumTier}\` (\`${guild.premiumSubscriptionCount || 0}\` Boost)\n${eArr} Güvenlik (Doğrulama): \`${verLevel}\`\n\n${eSet} **Yapı ve İçerik:**\n${eArr} Toplam Rol: \`${rolesCount}\` adet\n${eArr} Toplam Kanal: \`${textChannels + voiceChannels}\` (M: \`${textChannels}\`, S: \`${voiceChannels}\`, K: \`${categories}\`)\n${eArr} Emojiler: \`${emojisCount}\` adet (\`${animatedEmojis}\` Hareketli)\n${eArr} Çıkartmalar: \`${stickersCount}\` adet`;
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

        title = 'Sunucu İstatistikleri | Üye Analizi';
        description = `${eCrown} **Nüfus Dağılımı:**\n${eArr} Toplam Nüfus: \`${guild.memberCount}\`\n${eArr} Gerçek Kullanıcı: \`${humans}\`\n${eArr} Bot Sayısı: \`${bots}\`\n\n${eStat} **Büyüme Hızı (Katılım):**\n${eArr} Son 24 Saatte Gelenler: \`${new24h}\` kişi\n${eArr} Son 7 Günde Gelenler: \`${new7d}\` kişi\n\n${eSet} **Sesli Kanal Aktivitesi:**\n${eArr} Şu An Seste Olanlar: \`${inVoice}\` kişi\n${eArr} Mikrofonu Kapalılar (Mute): \`${selfMuted}\` kişi\n${eArr} Kulaklığı Kapalılar (Deaf): \`${selfDeaf}\` kişi\n${eArr} Yayın Açanlar (Stream): \`${streaming}\` kişi\n${eArr} Kamera Açanlar: \`${video}\` kişi`;
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
        
        title = 'Sunucu İstatistikleri | Ceza & Bilet Raporu';
        description = `${eShield} **Adli Sicil Tablosu:**\n${eArr} Kalıcı Yasaklılar (Ban): \`${bansCount}\` kişi\n${eArr} Geçici Susturulmuş (Timeout): \`${mutedMembers.size}\` kişi\n\n-*Not: Eğer banlı üye varsa, tüm banlıların listesi bu mesaja .txt olarak eklenmiştir.*\n\n${eTicket} **Destek Talebi (Ticket) Yoğunluğu:**\n${eArr} Şu an Aktif (Açık): \`${tOpen}\` bilet\n${eArr} Çözülüp Kapatılan: \`${tClosed}\` bilet\n${eArr} Toplam Açılan: \`${tOpen + tClosed}\` bilet`;
    }

    if (pageName === 'page_davet') {
        title = 'Sunucu İstatistikleri | Davet Laboratuvarı';
        description = `${eInvite} **En Verimli Davet Linkleri (İlk 5):**\n\n`;
        
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

        title = 'Sunucu İstatistikleri | Sistem ve Veritabanı';
        description = `${eDb} **Veritabanı Yükü:**\n${eArr} Toplam Kayıtlı Uyarı (Warn): \`${warnCount}\` adet\n${eArr} Toplam İşlenmiş Bilet (Ticket): \`${tCount}\` bilet\n${eArr} Sistem Tarafından Engellenen Spam: \`${spamCount}\` olay\n\n${eSet} **Modül Durumları:**\n${eArr} Yüklü Komut Sayısı: \`${cmdCount}\` Aktif Komut\n${eArr} Özel Oda (Private Room) Sistemi: \`${setupStatus}\`\n\n-*Sunucu ayarlarının detaylı yapılandırmasını görmek için \`/ayarlar\` komutunu kullanın.*`;
    }

    const payload = buildModAPanel({
        title,
        description,
        navRow: menuRow,
        showSocials: false
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
            await interaction.deferReply();
            conn = await pool.getConnection();

            const initialPayload = await getStatsPage(interaction, 'page_genel', conn);
            const msg = await interaction.editReply(initialPayload);

            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id && !systemNode.checkSystemNode(i.user.id)) {
                    return i.reply({ content: 'Bu menüyü sadece komutu yazan kullanabilir.', ephemeral: true });
                }

                try { await i.deferUpdate(); } catch(e) { return; }
                const page = i.values[0];
                
                let tempConn;
                try {
                    tempConn = await pool.getConnection();
                    const newPayload = await getStatsPage(interaction, page, tempConn);
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
