const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { createContainerMessage, buildModAPanel, MONO_EMOJIS } = require('../../utils/uiBuilder');

function createHelpComponents(selected = 'home') {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('yardim:help_category_select')
            .setPlaceholder('Bir yardım kategorisi seçin...')
            .addOptions([
                { label: 'Ana Sayfa', value: 'help_home', description: 'Yardım paneli ana sayfası ve genel bakış', default: selected === 'home' },
                { label: 'Müzik & Ses Sistemleri', value: 'help_music', description: 'Play, Pause, Skip, Like, Filter, 247, Queue vb. (16 Komut)', default: selected === 'music' },
                { label: 'Ceza & Moderasyon', value: 'help_punish', description: 'Ban, Kick, Mute, Warn, Not vb. (11 Komut)', default: selected === 'punish' },
                { label: 'Sistem & Güvenlik Panelleri', value: 'help_system', description: 'Log, AutoMod, Hoşgeldin, Ticket, Bot-Bilgi, Ping vb. (12 Komut)', default: selected === 'system' },
                { label: 'Kanal & Mesaj Yönetimi', value: 'help_channel', description: 'Clear, Lockdown, Nuke, Slowmode, Snipe vb. (6 Komut)', default: selected === 'channel' },
                { label: 'Yetkili & Kadro Yönetimi', value: 'help_staff', description: 'Yetkili Panosu, Başvuru, Mod-Stat (3 Komut)', default: selected === 'staff' },
                { label: 'Sunucu & Kullanıcı Bilgisi', value: 'help_stats', description: 'Sunucu-Bilgi, Sunucu-Resim, Sorgu, İstatistik vb. (6 Komut)', default: selected === 'stats' },
                { label: 'Topluluk & Yardımcı Araçlar', value: 'help_community', description: 'Öneri, İtibar, AFK, Hatırlat, Avatar vb. (12 Komut)', default: selected === 'community' }
            ])
    );
}

function helpEmbedHome(guild, user, actionRows = []) {
    return buildModAPanel({
        title: 'Yönetim & Komut Rehberi',
        description: `Sayın <@${user.id}>, **Turklion Moderasyon & Müzik Botu** yardım paneline hoş geldiniz.\n\n` +
                     `Sunucumuzda aktif olarak **67 adet bağımsız komut** bulunmaktadır.\n` +
                     `Aşağıdaki menüyü kullanarak incelemek istediğiniz kategoriyi seçebilir; komutların kullanım formatlarını, parametrelerini ve zorunlu/opsiyonel durumlarını detaylıca görebilirsiniz.`,
        navRow: actionRows[0],
        showSocials: true
    });
}

function getCategoryHelpPayload(categoryKey) {
    const navMenu = createHelpComponents(categoryKey.replace('help_', ''));

    if (categoryKey === 'help_music') {
        const title = `<:mono:${MONO_EMOJIS.music || '1537767791908884500'}> Müzik & Ses Sistemleri (16 Komut)`;
        const desc = `Spotify, YouTube Music, SoundCloud ve bağlantı akışlarını yöneten stüdyo kalitesinde müzik motoru:`;
        const fields = [
            {
                name: '1. /play & /nowplaying',
                value: `\`\`\`/play [sarki: ZORUNLU]\`\`\`Şarkı adı, sanatçı veya çalma listesi linki ile anında müzik başlatır.\n\`\`\`/nowplaying\`\`\`Çalan şarkının ilerleme durumunu, ses seviyesini, filtresini ve kontrol butonlarını açar.`
            },
            {
                name: '2. /pause & /resume & /stop',
                value: `\`\`\`/pause\`\`\`Çalan müziği duraklatır.\n\`\`\`/resume\`\`\`Duraklatılmış müziği devam ettirir.\n\`\`\`/stop\`\`\`Müziği tamamen durdurur, sırayı temizler ve ses kanalından ayrılır.`
            },
            {
                name: '3. /skip & /seek',
                value: `\`\`\`/skip\`\`\`Çalan şarkıyı atlar (Oylama / DJ / Şarkıyı açan kişi korumalı).\n\`\`\`/seek [zaman: ZORUNLU]\`\`\`Şarkıyı belirli bir dakikaya/saniyeye sarar (Örn: 1:30 veya 90).`
            },
            {
                name: '4. /queue & /shuffle & /loop',
                value: `\`\`\`/queue <sayfa: İSTEĞE BAĞLI>\`\`\`Sıradaki şarkıların listesini gösterir.\n\`\`\`/shuffle\`\`\`Sıradaki tüm parçaları rastgele karıştırır.\n\`\`\`/loop [mod: ZORUNLU (track/queue/none)]\`\`\`Şarkı veya sıra döngü modunu ayarlar.`
            },
            {
                name: '5. /volume & /filter',
                value: `\`\`\`/volume [seviye: ZORUNLU (0-150)]\`\`\`Müzik ses seviyesini ayarlar.\n\`\`\`/filter [efekt: ZORUNLU (bassboost/nightcore/8d/vaporwave/clear)]\`\`\`Canlı ekolayzır ve ses efektlerini uygular.`
            },
            {
                name: '6. /like & /lyrics',
                value: `\`\`\`/like [ekle / liste / çal]\`\`\`Favori parçalarını kaydeder, listeler ve tek tıkla ses kanalında başlatır.\n\`\`\`/lyrics <sarki: İSTEĞE BAĞLI>\`\`\`Çalan şarkının sözlerini görüntüler.`
            },
            {
                name: '7. /247 & /music-history',
                value: `\`\`\`/247 [durum: ZORUNLU (on/off)]\`\`\`Botun ses kanalında 7/24 kesintisiz kalma modunu yönetir.\n\`\`\`/music-history\`\`\`Sunucuda son çalınan şarkıların geçmiş dökümünü listeler.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    if (categoryKey === 'help_punish') {
        const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Ceza & Moderasyon Komutları (11 Komut)`;
        const desc = `Kuralları ihlal eden kullanıcılara uygulanacak doğrudan moderasyon ve yaptırım komutları:`;
        const fields = [
            {
                name: '1. /ban & /unban',
                value: `\`\`\`/ban [kullanıcı: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Kullanıcıyı sunucudan kalıcı olarak uzaklaştırır.\n\`\`\`/unban [kullanıcı: ZORUNLU]\`\`\`Yasaklı üyenin sunucu banını kaldırır.`
            },
            {
                name: '2. /ban-list & /softban',
                value: `\`\`\`/ban-list\`\`\`Sunucudaki tüm yasaklı kullanıcıları listeler.\n\`\`\`/softban [kullanici: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Kullanıcıyı banlayıp anında açarak son mesajlarını temizler.`
            },
            {
                name: '3. /kick',
                value: `\`\`\`/kick [kullanıcı: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Kullanıcıyı sunucudan atar (tekrar katılabilir).`
            },
            {
                name: '4. /mute & /unmute',
                value: `\`\`\`/mute [kullanıcı: ZORUNLU] [süre: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Metin kanallarında susturur (Timeout - Örn: 10m, 1h, 1d).\n\`\`\`/unmute [kullanıcı: ZORUNLU]\`\`\`Kullanıcının susturma cezasını kaldırır.`
            },
            {
                name: '5. /vmute',
                value: `\`\`\`/vmute [kullanıcı: ZORUNLU] [süre: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Kullanıcının ses kanallarında konuşmasını engeller.`
            },
            {
                name: '6. /warn & /warn-sil',
                value: `\`\`\`/warn [user: ZORUNLU] [reason: ZORUNLU]\`\`\`Kullanıcıya resmi uyarı verir ve ceza siciline kaydeder.\n\`\`\`/warn-sil [kullanici: ZORUNLU]\`\`\`Kullanıcının aktif uyarılarını sıfırlar/siler.`
            },
            {
                name: '7. /not',
                value: `\`\`\`/not ekle [kullanıcı: ZORUNLU] [not: ZORUNLU]\`\`\`Kullanıcıya gizli moderatör notu ekler.\n\`\`\`/not listele [kullanıcı: ZORUNLU]\`\`\`Kullanıcının moderatör notlarını listeler.\n\`\`\`/not sil [id: ZORUNLU]\`\`\`Belirtilen ID'li notu siler.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    if (categoryKey === 'help_system') {
        const title = `<:mono:${MONO_EMOJIS.settings || '1530917511711948903'}> Sistem & Güvenlik Panelleri (12 Komut)`;
        const desc = `Sunucu altyapısını, filtreleri, logları ve otomasyonları yöneten interaktif paneller:`;
        const fields = [
            {
                name: '1. /log',
                value: `\`\`\`/log\`\`\`14 Kategori & 51 Olay, Yok Sayma Listeleri, Canlı İzin Tanılama ve 2dk Gruplamalı Log Kontrol Merkezi.`
            },
            {
                name: '2. /automod',
                value: `\`\`\`/automod\`\`\`Anti-Spam, Link Engeli, Küfür Koruması, CapsLock ve Anti-Raid Koruma Merkezi.`
            },
            {
                name: '3. /blacklist',
                value: `\`\`\`/blacklist ekle [kelime: ZORUNLU] [tur: ZORUNLU]\`\`\`Sunucuya özel yasaklı kelime ekler.\n\`\`\`/blacklist sil [kelime: ZORUNLU]\`\`\`Yasaklı kelimeyi listeden çıkarır.\n\`\`\`/blacklist liste\`\`\`Yasaklı kelimeleri listeler.\n\`\`\`/blacklist senkronize\`\`\`Github Türkçe küfür listesini otomatik yükler.`
            },
            {
                name: '4. /hosgeldin',
                value: `\`\`\`/hosgeldin\`\`\`Karşılama & Uğurlama kanalları, özel başlıklar, kart görselleri ve dinamik değişkenler paneli.`
            },
            {
                name: '5. /otorol & /uyari-ayar',
                value: `\`\`\`/otorol\`\`\`Yeni üyelere ve botlara otomatik verilecek roller paneli.\n\`\`\`/uyari-ayar ayarla [uyari_sayisi: ZORUNLU] [ceza: ZORUNLU] <sure: İSTEĞE BAĞLI>\`\`\`Otomatik ceza eşikleri ayarlar.\n\`\`\`/uyari-ayar liste\`\`\`Mevcut uyarı cezalarını listeler.`
            },
            {
                name: '6. /ticket & /ozel-oda',
                value: `\`\`\`/ticket\`\`\`HTML & Metin transkriptli gelişmiş bilet/destek yönetim paneli.\n\`\`\`/ozel-oda\`\`\`Geçici özel ses ve metin odaları oluşturma ve kontrol paneli.`
            },
            {
                name: '7. /prefix & /backup',
                value: `\`\`\`/prefix\`\`\`Sunucuya özel çoklu ön ek (prefix) yönetim paneli.\n\`\`\`/backup\`\`\`Sunucunun kanal, kategori ve rol yapısının tam yedeğini alır.`
            },
            {
                name: '8. /bot-bilgi & /ping',
                value: `\`\`\`/bot-bilgi\`\`\`Botun donanım, RAM, CPU, Uptime, sunucu ve kullanıcı istatistikleri.\n\`\`\`/ping\`\`\`Canlı WebSocket, REST API ve MariaDB veritabanı yanıt hızını test eder.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    if (categoryKey === 'help_channel') {
        const title = `<:mono:${MONO_EMOJIS.channel || '1537770137136922694'}> Kanal & Mesaj Yönetimi (6 Komut)`;
        const desc = `Metin kanallarında düzen, güvenlik ve içerik yönetimi komutları:`;
        const fields = [
            {
                name: '1. /clear',
                value: `\`\`\`/clear [miktar: ZORUNLU (1-100)] <kullanıcı: İSTEĞE BAĞLI>\`\`\`Kanalda belirtilen miktarda mesajı topluca siler.`
            },
            {
                name: '2. /lockdown & /nuke',
                value: `\`\`\`/lockdown [durum: ZORUNLU (Aç / Kapat)]\`\`\`Kanalı üye mesajlarına kilitler veya açar.\n\`\`\`/nuke\`\`\`Kanalı tüm izinleriyle silip sıfırdan tertemiz oluşturur.`
            },
            {
                name: '3. /slowmode & /snipe',
                value: `\`\`\`/slowmode [saniye: ZORUNLU (Kapatmak için 0)]\`\`\`Kanala mesaj yazma bekleme süresi koyar.\n\`\`\`/snipe\`\`\`Kanalda silinen en son mesajı ve yazarını gösterir.`
            },
            {
                name: '4. /sabit-mesaj & /yaz',
                value: `\`\`\`/sabit-mesaj ayarla [mesaj: ZORUNLU] <kanal: İSTEĞE BAĞLI>\`\`\`Kanalın en altında sürekli duran sabit mesaj kurar.\n\`\`\`/sabit-mesaj kapat <kanal: İSTEĞE BAĞLI>\`\`\`Sabit mesajı kaldırır.\n\`\`\`/yaz [mesaj: ZORUNLU] <kanal: İSTEĞE BAĞLI>\`\`\`Bot üzerinden kanala biçimlendirilmiş duyuru/mesaj yazar.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    if (categoryKey === 'help_staff') {
        const title = `<:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> Yetkili & Kadro Yönetimi (3 Komut)`;
        const desc = `Sunucu yetkili ekibi, başvuru ve performans takip komutları:`;
        const fields = [
            {
                name: '1. /yetkili-panosu',
                value: `\`\`\`/yetkili-panosu\`\`\`Sesli ve aktif yetkilileri canlı gösteren otomatik senkronize kadro paneli kurar.`
            },
            {
                name: '2. /yetkili-basvuru',
                value: `\`\`\`/yetkili-basvuru\`\`\`Üyelerin yetkili olmak için başvurabileceği interaktif form paneli oluşturur.`
            },
            {
                name: '3. /mod-stat',
                value: `\`\`\`/mod-stat\`\`\`Sunucudaki yetkililerin ban, mute, kick ve warn puanlarını sıralayan liderlik tablosunu açar.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    if (categoryKey === 'help_stats') {
        const title = `<:mono:${MONO_EMOJIS.status || '1530917510189285528'}> Sunucu & Kullanıcı Bilgisi (6 Komut)`;
        const desc = `Sunucu kimliği, kullanıcı sorgulama, görseller ve analiz komutları:`;
        const fields = [
            {
                name: '1. /sunucu-bilgi & /sunucu-resim',
                value: `\`\`\`/sunucu-bilgi\`\`\`Sunucunun kimliği, sahibi, kuruluş tarihi, boost durumu, güvenlik seviyesi, kanal ve rol dağılımı.\n\`\`\`/sunucu-resim <tür: İSTEĞE BAĞLI (İkon/Banner/Splash)>\`\`\`Sunucunun profil ikonu, afişi ve davet arka planını HD önizler ve indirme butonları sunar.`
            },
            {
                name: '2. /sorgu',
                value: `\`\`\`/sorgu [kullanici: ZORUNLU]\`\`\`Kullanıcının hesap yaşı, rolleri, uyarıları, cezaları, itibar puanı, davetleri ve mod notlarını tek ekranda sunar.`
            },
            {
                name: '3. /istatistik',
                value: `\`\`\`/istatistik\`\`\`Sunucunun büyüme hızı (24s/7g), canlı ses odaları aktivitesi ve moderasyon işlem yoğunluğunu listeler.`
            },
            {
                name: '4. /davet & /davet-sıralama',
                value: `\`\`\`/davet <kullanıcı: İSTEĞE BAĞLI>\`\`\`Kullanıcının gerçek, sahte ve ayrılan davet istatistiğini gösterir.\n\`\`\`/davet-sıralama\`\`\`Sunucuda en çok davet yapanların liderlik tablosunu gösterir.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    if (categoryKey === 'help_community') {
        const title = `<:mono:${MONO_EMOJIS.smile || '1537767786502426665'}> Topluluk & Yardımcı Araçlar (12 Komut)`;
        const desc = `Kullanıcı etkileşimi, profil araçları ve sunucu yardımcı komutları:`;
        const fields = [
            {
                name: '1. /oneri & /itibar',
                value: `\`\`\`/oneri panel\`\`\`Üyelerin öneri gönderebileceği oylamalı öneri panelini açar.\n\`\`\`/itibar ver [kullanici: ZORUNLU]\`\`\`Kullanıcıya +rep itibar puanı verir.\n\`\`\`/itibar goruntule <kullanici: İSTEĞE BAĞLI>\`\`\`İtibar puanını görüntüler.`
            },
            {
                name: '2. /afk & /hatirlat',
                value: `\`\`\`/afk <sebep: İSTEĞE BAĞLI>\`\`\`AFK moduna geçer, sizi etiketleyenlere bilgi verir.\n\`\`\`/hatirlat [sure: ZORUNLU] [not: ZORUNLU]\`\`\`Belirtilen süre sonra size özel hatırlatma mesajı atar.`
            },
            {
                name: '3. /avatar & /banner & /spotify',
                value: `\`\`\`/avatar <kullanici: İSTEĞE BAĞLI>\`\`\`Kullanıcının sunucu veya global profil fotoğrafını büyütür.\n\`\`\`/banner <kullanici: İSTEĞE BAĞLI>\`\`\`Kullanıcının profil afişini görüntüler.\n\`\`\`/spotify <kullanici: İSTEĞE BAĞLI>\`\`\`Kullanıcının o an dinlediği Spotify şarkısını gösterir.`
            },
            {
                name: '4. /re & /rol-olustur',
                value: `\`\`\`/re [emoji: ZORUNLU]\`\`\`Başka sunucudan veya mesajdan emoji kopyalar (Emoji Çalma).\n\`\`\`/rol-olustur [isim: ZORUNLU] <renk: İSTEĞE BAĞLI> <ayrilmis: İSTEĞE BAĞLI>\`\`\`Parametrik yeni rol açar.`
            },
            {
                name: '5. /yasakli-kanal & /yaz & /yardım',
                value: `\`\`\`/yasakli-kanal ekle [kanal: ZORUNLU]\`\`\`Kanalı bot komutlarına kapatır.\n\`\`\`/yasakli-kanal sil [kanal: ZORUNLU]\`\`\`Yasağı kaldırır.\n\`\`\`/yasakli-kanal liste\`\`\`Yasaklı kanalları listeler.\n\`\`\`/yardım\`\`\`Bu yardım ve komut rehberi menüsünü açar.`
            }
        ];
        return createContainerMessage(title, desc, '#2B2D31', [navMenu], fields, false);
    }

    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardım')
        .setDescription('Sistem yönetimi ve tüm komutlar hakkında bilgi almak için yardım panelini açar.'),

    createHelpComponents,
    helpEmbedHome,
    getCategoryHelpPayload,

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const selectRow = createHelpComponents('home');
            const fullPayload = helpEmbedHome(interaction.guild, interaction.user, [selectRow]);
            await interaction.editReply(fullPayload);
        } catch (error) {
            console.error('Yardım komutu hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Yardım menüsü açılırken hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Yardım menüsü açılırken hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
