const {
    SlashCommandBuilder,
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const { createContainerMessage, buildModAPanel, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');

function createHelpComponents(selected = 'home', member = null) {
    const isStaff = member && (
        member.permissions?.has(PermissionFlagsBits.ModerateMembers) ||
        member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
        member.permissions?.has(PermissionFlagsBits.Administrator)
    );

    const options = [
        {
            label: 'Ana Sayfa',
            value: 'help_home',
            emoji: MONO_EMOJIS.settings || '1538517265807442090',
            description: 'Yardım paneli genel bakış ve sunucu bilgisi',
            default: selected === 'home'
        },
        {
            label: 'Minecraft & Günlük Görevler',
            value: 'help_minecraft',
            emoji: MONO_EMOJIS.wand_sparkles || '1537767764918538371',
            description: 'Gorev, Rank, Top, MC-Skin, MC-Sunucu',
            default: selected === 'minecraft'
        },
        {
            label: 'Müzik & Ses Sistemleri',
            value: 'help_music',
            emoji: MONO_EMOJIS.disc_3 || '1538517605902716960',
            description: 'Play, Lyrics, Queue, Filter, Like, 247',
            default: selected === 'music'
        },
        {
            label: 'Sunucu & Kullanıcı Bilgisi',
            value: 'help_stats',
            emoji: MONO_EMOJIS.status || '1538517274082938941',
            description: 'Sunucu-Bilgi, Profil, Sorgu, İstatistik, Davet',
            default: selected === 'stats'
        },
        {
            label: 'Topluluk & Eğlence Araçları',
            value: 'help_community',
            emoji: MONO_EMOJIS.smile || '1538517365011259483',
            description: 'Öneri, İtibar (+Rep), Çekiliş, AFK, Avatar',
            default: selected === 'community'
        },
        {
            label: 'Eğlence & Oyunlar',
            value: 'help_fun',
            emoji: MONO_EMOJIS.gamepad || '1538517365011259483',
            description: '8Ball, Zar, XOX, Düello, GIF, bilgi yarışması',
            default: selected === 'fun'
        },
        {
            label: 'Ekonomi & Casino',
            value: 'help_eco',
            emoji: MONO_EMOJIS.coins || '1538517365011259483',
            description: 'Cüzdan, Market, Çalış, Slots, Blackjack, Crash',
            default: selected === 'eco'
        },
        {
            label: 'Bilgi & Araçlar',
            value: 'help_bilgi',
            emoji: MONO_EMOJIS.search || '1538517365011259483',
            description: 'Hava, Çeviri, Kripto, Döviz, QR, Wiki',
            default: selected === 'bilgi'
        }
    ];

    if (isStaff) {
        options.push(
            {
                label: 'Ceza & Moderasyon',
                value: 'help_punish',
                emoji: MONO_EMOJIS.shield || '1538517311797854265',
                description: 'Ban, Kick, Mute, Warn, Not Yönetimi',
                default: selected === 'punish'
            },
            {
                label: 'Sistem & Güvenlik Panelleri',
                value: 'help_system',
                emoji: MONO_EMOJIS.lock || '1538517230403330058',
                description: 'Level, Ticket, AutoMod, Log, Otorol, Hoşgeldin',
                default: selected === 'system'
            },
            {
                label: 'Kanal & Mesaj Yönetimi',
                value: 'help_channel',
                emoji: MONO_EMOJIS.folder || '1538517289333297192',
                description: 'Clear, Purge, Lockdown, Nuke, Slowmode, Snipe',
                default: selected === 'channel'
            },
            {
                label: 'Yetkili & Kadro Yönetimi',
                value: 'help_staff',
                emoji: MONO_EMOJIS.crown || '1530918952711094272',
                description: 'Yetkili Panosu, Başvuru, Mod-Stat, Mesai',
                default: selected === 'staff'
            }
        );
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('yardim:help_category_select')
            .setPlaceholder('Kategori Seçerek Komutları İnceleyin...')
            .addOptions(options)
    );
}

function helpEmbedHome(guild, user, actionRows = [], member = null) {
    const isStaff = member && (
        member.permissions?.has(PermissionFlagsBits.ModerateMembers) ||
        member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
        member.permissions?.has(PermissionFlagsBits.Administrator)
    );

    const staffText = isStaff 
        ? `\n<:mono:${MONO_EMOJIS.shield}> *Yetkili statüsündesiniz: Ceza, Güvenlik, Kanal ve Kadro kategorileri menüde açıktır.*` 
        : `\n<:mono:${MONO_EMOJIS.gamepad || MONO_EMOJIS.user}> *Üye statüsündesiniz: Genel topluluk, müzik ve Minecraft komutları listelenmektedir.*`;

    return buildModAPanel({
        title: 'Nyx - Komut Rehberi',
        description: `Sayın <@${user.id}>, **Nyx Moderasyon, Müzik & Topluluk Botu** yardım merkezine hoş geldiniz.\n\n` +
                      `Sunucumuzda **170+ aktif komut ve interaktif sistem** çalışmaktadır.\n` +
                     `Aşağıdaki menüden incelemek istediğiniz kategoriyi seçerek komutların kullanım formatlarını ve parametrelerini detaylıca görebilirsiniz.${staffText}`,
        navRow: actionRows[0],
        showSocials: true
    });
}

function getCategoryHelpPayload(categoryKey, member = null) {
    const navMenu = createHelpComponents(categoryKey.replace('help_', ''), member);

    if (categoryKey === 'help_minecraft') {
        const title = `Minecraft & Günlük Görev Sistemleri`;
        const desc = `Nyx seviye motoru, günlük görevler ve Minecraft oyuncu araçları:`;
        const fields = [
            {
                name: '1. /gorev',
                value: `\`\`\`/gorev\`\`\`Her gün 00:00'da kişiye özel rastgele yenilenen 3 Minecraft görevini görüntüler ve XP ödüllerini toplar.`
            },
            {
                name: '2. /rank & /top',
                value: `\`\`\`/rank <kullanici: İSTEĞE BAĞLI>\`\`\`Mevcut seviyenizi, XP barınızı, maden rütbenizi ve aktivite dökümünüzü görüntüler.\n\`\`\`/top <kategori: İSTEĞE BAĞLI>\`\`\`Genel XP, Mesaj, Ses, Davet ve İtibar kategorilerine göre filtrelenebilir canlı liderlik tablosunu açar.`
            },
            {
                name: '3. /mc skin & /mc sunucu',
                value: `\`\`\`/mc skin [kullanici: ZORUNLU]\`\`\`Minecraft oyuncusunun 3D skin ve pelerin modelini görüntüler.\n\`\`\`/mc sunucu [ip: ZORUNLU]\`\`\`Minecraft sunucusunun anlık çevrimiçi durumunu, pingini ve oyuncu sayısını sorgular.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_music') {
        const title = `Müzik & Ses Sistemleri`;
        const desc = `Lavalink destekli, yüksek ses kalitesine sahip müzik ve şarkı sözü motoru:`;
        const fields = [
            {
                name: '1. /play & /nowplaying & /lyrics',
                value: `\`\`\`/play [sarki: ZORUNLU]\`\`\`Şarkı adı, sanatçı veya bağlantı ile anında müzik başlatır.\n\`\`\`/nowplaying\`\`\`Çalan şarkının ilerleme çubuğunu ve canlı kontrol butonlarını açar.\n\`\`\`/lyrics <sarki: İSTEĞE BAĞLI>\`\`\`Çalan veya aranan şarkının sözlerini LRCLIB üzerinden anında getirir.`
            },
            {
                name: '2. /pause & /resume & /stop',
                value: `\`\`\`/pause\`\`\`Çalan parçayı duraklatır.\n\`\`\`/resume\`\`\`Duraklatılan parçayı devam ettirir.\n\`\`\`/stop\`\`\`Müziği durdurur, sırayı temizler ve ses kanalından ayrılır.`
            },
            {
                name: '3. /skip & /seek & /queue',
                value: `\`\`\`/skip\`\`\`Sıradaki sonraki şarkıya atlar.\n\`\`\`/seek [zaman: ZORUNLU]\`\`\`Şarkıyı belirli bir dakikaya/saniyeye sarar.\n\`\`\`/queue <sayfa: İSTEĞE BAĞLI>\`\`\`Sıradaki parçaların listesini sayfalı görüntüler.`
            },
            {
                name: '4. /volume & /filter & /like',
                value: `\`\`\`/volume [seviye: ZORUNLU (0-150)]\`\`\`Müzik ses seviyesini ayarlar.\n\`\`\`/filter [efekt: ZORUNLU]\`\`\`Bassboost, Nightcore, 8D, Vaporwave ekolayzır efektlerini uygular.\n\`\`\`/like [ekle / liste / çal]\`\`\`Favori parçalarınızı kaydeder ve tek tıkla çalar.`
            },
            {
                name: '5. /247 & /music-history',
                value: `\`\`\`/247 [durum: ZORUNLU]\`\`\`Botun ses kanalında 7/24 kesintisiz kalma modunu yönetir.\n\`\`\`/music-history\`\`\`Sunucuda son çalınan parçaların dökümünü listeler.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_punish') {
        const title = `Ceza & Moderasyon Komutları`;
        const desc = `Kuralları ihlal eden kullanıcılara uygulanacak doğrudan yaptırım komutları:`;
        const fields = [
            {
                name: '1. /ban & /unban & /softban',
                value: `\`\`\`/ban [kullanıcı: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Kullanıcıyı sunucudan uzaklaştırır.\n\`\`\`/unban [kullanıcı: ZORUNLU]\`\`\`Kullanıcının sunucu banını kaldırır.\n\`\`\`/softban [kullanıcı: ZORUNLU]\`\`\`Kullanıcıyı banlayıp anında açarak son mesajlarını temizler.`
            },
            {
                name: '2. /kick & /mute & /unmute',
                value: `\`\`\`/kick [kullanıcı: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Kullanıcıyı sunucudan atar.\n\`\`\`/mute [kullanıcı: ZORUNLU] [süre: ZORUNLU] <sebep: İSTEĞE BAĞLI>\`\`\`Zaman aşımı (Timeout) ile metin kanallarında susturur.\n\`\`\`/unmute [kullanıcı: ZORUNLU]\`\`\`Kullanıcının susturma cezasını kaldırır.`
            },
            {
                name: '3. /warn & /warn-sil & /not & /süreli-ban',
                value: `\`\`\`/warn [kullanıcı: ZORUNLU] [sebep: ZORUNLU]\`\`\`Kullanıcıya resmi uyarı verir ve sicile işler.\n\`\`\`/warn-sil [kullanıcı: ZORUNLU]\`\`\`Kullanıcının aktif uyarılarını sıfırlar.\n\`\`\`/not [ekle / listele / sil]\`\`\`Kullanıcı üzerine gizli yetkili notu bırakır.\n\`\`\`/süreli-ban [uye] [sure] [sebep]\`\`\`Süre bitince otomatik açılan yasaklama.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_system') {
        const title = `Sistem & Güvenlik Panelleri`;
        const desc = `Sunucu altyapısını, filtreleri, logları ve otomasyonları yöneten interaktif paneller:`;
        const fields = [
            {
                name: '1. /level (Seviye Yönetim Merkezi)',
                value: `\`\`\`/level\`\`\`XP katsayıları, Minecraft maden rol ödülleri, kanal muafiyetleri, manuel XP verme ve **Kullanıcıdan XP Düşürme (Ceza)** kontrol paneli.`
            },
            {
                name: '2. /ticket & /automod & /log',
                value: `\`\`\`/ticket\`\`\`Transkriptli bilet yönetim paneli.\n\`\`\`/automod\`\`\`Anti-Spam, Link, Küfür, CapsLock koruma merkezi.\n\`\`\`/log\`\`\`14 kategori & 51 olay detaylı kayıt paneli.`
            },
            {
                name: '3. /hosgeldin & /otorol & /uyari-ayar & /oto-kurulum & /özelleştir',
                value: `\`\`\`/hosgeldin\`\`\`Karşılama/Uğurlama kanalları ve kart ayarları.\n\`\`\`/otorol\`\`\`Otomatik üye ve bot rol dağıtımı.\n\`\`\`/uyari-ayar\`\`\`Belirli uyarı sayısına ulaşanlara otomatik ceza verme kuralları.\n\`\`\`/oto-kurulum\`\`\`Log + karşılama + sayaç + doğrulamayı tek tıkla kurar.\n\`\`\`/özelleştir\`\`\`Karşılama/ayrılış/DM mesajlarını düzenler + önizler.`
            },
            {
                name: '4. /kayıt & /doğrulama & /sayaç & /etkinlik & /kurallar',
                value: `\`\`\`/kayıt [uye] [isim] [yas]\`\`\`İsim-yaş kaydı + rol + log.\n\`\`\`/doğrulama kur\`\`\`Matematik sorulu doğrulama paneli.\n\`\`\`/sayaç ayarla\`\`\`Kanal isminde canlı üye sayacı.\n\`\`\`/etkinlik olustur\`\`\`Katılım butonlu etkinlik kartı.\n\`\`\`/kurallar\`\`\`Kabul Et butonlu kurallar paneli.`
            },
            {
                name: '5. /rol-ver & /toplu-rol & /duyuru & /geri-sayım & /kanal-kilit',
                value: `\`\`\`/rol-ver & /rol-al\`\`\`Hiyerarşi kontrollü rol işlemi.\n\`\`\`/toplu-rol\`\`\`Onaylı toplu rol dağıtımı.\n\`\`\`/duyuru yayınla\`\`\`Rol etiketli V2 duyuru kartı.\n\`\`\`/geri-sayım\`\`\`Aynı mesajda canlı sayaç.\n\`\`\`/kanal-kilit\`\`\`Metin kanalını kilitle/aç.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_channel') {
        const title = `Kanal & Mesaj Yönetimi`;
        const desc = `Metin kanallarında düzen, temizlik ve mesaj yönetimi komutları:`;
        const fields = [
            {
                name: '1. /clear & /purge',
                value: `\`\`\`/clear [miktar: ZORUNLU (1-100)] <kullanıcı: İSTEĞE BAĞLI>\`\`\`Kanalda belirtilen miktarda mesajı topluca siler.\n\`\`\`/purge\`\`\`Gelişmiş filtreli mesaj temizleme panelini açar.`
            },
            {
                name: '2. /lockdown & /nuke',
                value: `\`\`\`/lockdown [durum: ZORUNLU]\`\`\`Kanalı üye mesajlarına anında kilitler veya açar.\n\`\`\`/nuke\`\`\`Kanalı tüm izinleriyle klonlayıp mesajları sıfırlar.`
            },
            {
                name: '3. /slowmode & /snipe & /kanal-kilit',
                value: `\`\`\`/slowmode [saniye: ZORUNLU]\`\`\`Kanala mesaj yazma bekleme süresi koyar.\n\`\`\`/snipe\`\`\`Kanalda silinen en son mesajı ve yazarını gösterir.\n\`\`\`/kanal-kilit [durum]\`\`\`Kanalı kilitler veya açar.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_staff') {
        const title = `Yetkili & Kadro Yönetimi`;
        const desc = `Sunucu yetkili ekibi, performans takip ve kadro araçları:`;
        const fields = [
            {
                name: '1. /yetkili-panosu & /yetkili-basvuru',
                value: `\`\`\`/yetkili-panosu\`\`\`Seste ve aktif olan yetkilileri canlı gösteren otomatik pano kurar.\n\`\`\`/yetkili-basvuru\`\`\`Üyelerin yetkili olmak için başvurabileceği interaktif form paneli oluşturur.`
            },
            {
                name: '2. /mod-stat',
                value: `\`\`\`/mod-stat\`\`\`Sunucudaki yetkililerin ban, mute, kick, warn ve bilet performans puanlarını listeleyen liderlik tablosunu açar.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_stats') {
        const title = `Sunucu & Kullanıcı Bilgisi`;
        const desc = `Sunucu kimliği, kullanıcı sorgulama, profil ve davet analiz komutları:`;
        const fields = [
            {
                name: '1. /sunucu-bilgi & /sunucu-resim',
                value: `\`\`\`/sunucu-bilgi\`\`\`Sunucunun kimliği, sahibi, kuruluş tarihi, boost durumu, kanal ve rol istatistikleri.\n\`\`\`/sunucu-resim <tür: İSTEĞE BAĞLI>\`\`\`Sunucunun ikon, afiş ve davet görselini HD görüntüler.`
            },
            {
                name: '2. /sorgu & /istatistik',
                value: `\`\`\`/sorgu [kullanici: ZORUNLU]\`\`\`Kullanıcının hesap yaşı, rolleri, uyarıları, cezaları ve sicil kartını tek ekranda sunar.\n\`\`\`/istatistik\`\`\`Sunucunun canlı aktivite ve ses yoğunluğu dökümünü listeler.`
            },
            {
                name: '3. /davet & /davet-sıralama & /profil & /evlen',
                value: `\`\`\`/davet <kullanıcı: İSTEĞE BAĞLI>\`\`\`Kullanıcının gerçek, sahte ve ayrılan davet istatistiğini gösterir.\n\`\`\`/davet-sıralama\`\`\`Sunucuda en çok davet yapanların sıralamasını listeler.\n\`\`\`/profil\`\`\`Seviye + servet + rozet + itibar + evlilik tek kartta.\n\`\`\`/evlen & /boşan & /ailem\`\`\`Teklifli evlilik + aile ağacı.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_fun') {
        const title = `Eğlence & Oyunlar`;
        const desc = `Butonlu mini oyunlar ve eğlence komutları (hepsi tek-mesaj, anlık güncellemeli):`;
        const fields = [
            {
                name: '1. /8ball & /zar & /yazı-tura & /aşk-ölçer & /espri & /gif',
                value: `\`\`\`/8ball [soru]\`\`\`Sihirli topa sor, Tekrar Sor butonuyla yenile.\n\`\`\`/zar [adet] [yuz]\`\`\`\`\`\`/yazı-tura\`\`\`\`\`\`/aşk-ölçer [birinci] [ikinci]\`\`\`\`\`\`/espri\`\`\`\`\`\`/gif [konu] [hedef]\`\`\`Tenor destekli rastgele GIF + Yeni GIF butonu.`
            },
            {
                name: '2. /xox & /düello & /zar-düello',
                value: `\`\`\`/xox [rakip]\`\`\`Butonlu tahta, herkese açık, kazanan 100 Jeton.\n\`\`\`/düello [rakip]\`\`\`Sıra tabanlı savaş, kazanan 150 Jeton.\n\`\`\`/zar-düello [rakip]\`\`\`Büyük zar atan kazanır (100 Jeton).`
            },
            {
                name: '3. /sayı-tahmin & /kelime-oyunu & /adam-asmaca & /hızlı-yaz',
                value: `\`\`\`/sayı-tahmin\`\`\`10 hak, az deneme çok ödül.\n\`\`\`/kelime-oyunu\`\`\`Karışık harften kelime bul.\n\`\`\`/adam-asmaca\`\`\`6 hakla kelime kurtar.\n\`\`\`/hızlı-yaz\`\`\`Kelimeyi hızlı yaz, süreye göre ödül.`
            },
            {
                name: '4. /taş-kağıt-makas & /bilgi-yarışması & /bunu-mu & /basar-mıydın',
                value: `\`\`\`/taş-kağıt-makas\`\`\`Bota karşı 3 tur (25 Jeton).\n\`\`\`/bilgi-yarışması\`\`\`Doğru cevap +40 Jeton.\n\`\`\`/bunu-mu\`\`\`\`\`\`/basar-mıydın\`\`\`Canlı oylamalı ikilemler.`
            },
            {
                name: '5. /sataş & /hack & /ilginç-bilgi & /dünya-saati & /kedi & /köpek',
                value: `\`\`\`/sataş [hedef]\`\`\`Dostça şaka.\n\`\`\`/hack [hedef]\`\`\`Şaka amaçlı simülasyon.\n\`\`\`/kedi\`\`\`\`\`\`/köpek\`\`\`Rastgele foto + Yeni butonu.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_eco') {
        const title = `Ekonomi & Casino`;
        const desc = `Jeton ekonomisi, market, işler ve şans oyunları:`;
        const fields = [
            {
                name: '1. /ekonomi & /market-yonet',
                value: `\`\`\`/ekonomi cuzdan\`\`\`Nakit + banka + toplam bakiye.\n\`\`\`/ekonomi gunluk\`\`\`Seri bonuslu günlük ödül.\n\`\`\`/ekonomi transfer\`\`\`Onay butonlu para gönderme.\n\`\`\`/ekonomi market\`\`\`Menüden seç, aynı kartta satın al.`
            },
            {
                name: '2. /çalış & /dilen & /saatlik & /hediye & /balık-tut & /suç-işle',
                value: `\`\`\`/çalış\`\`\`5dk cooldown ile kazanç.\n\`\`\`/suç-işle [hedef]\`\`\`Riskli soygun: kazan ya da tazminat öde.\n\`\`\`/balık-tut\`\`\`Nadirlikli balık, otomatik satış.\n\`\`\`/hediye\`\`\`30dk'da bir sürpriz kutu.`
            },
            {
                name: '3. /slots & /blackjack & /rulet & /crash',
                value: `\`\`\`/slots [bahis]\`\`\`3 aynı = 3x, ikili = 1.2x.\n\`\`\`/blackjack [bahis]\`\`\`Kart Al / Dur butonlu 21 (2x).\n\`\`\`/rulet [bahis] [secim]\`\`\`Renk/sayı bahsi (14x\'e kadar).\n\`\`\`/crash [bahis]\`\`\`Patlamadan önce Çekil'e bas!`
            },
            {
                name: '4. /basarim & /profil',
                value: `\`\`\`/basarim\`\`\`Sayfalı rozet kartın, ödüller otomatik yatar.\n\`\`\`/profil\`\`\`Seviye + servet + rozet + itibar tek kartta.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_bilgi') {
        const title = `Bilgi & Araçlar`;
        const desc = `Arama, hesaplama ve günlük araçlar (hepsinde Yenile butonu):`;
        const fields = [
            {
                name: '1. /hava-durumu & /döviz & /kripto',
                value: `\`\`\`/hava-durumu [sehir]\`\`\`\`\`\`/döviz\`\`\`\`\`\`/kripto [coin]\`\`\`Canlı veri + Yenile butonu.`
            },
            {
                name: '2. /çeviri & /wikipedia & /github & /npm',
                value: `\`\`\`/çeviri [metin] [hedef]\`\`\`8 dil desteği.\n\`\`\`/wikipedia [terim]\`\`\`\`\`\`/github [repo]\`\`\`\`\`\`/npm [paket]\`\`\``
            },
            {
                name: '3. /qr & /kısalt & /hesapla & /şifre-üret & /notlarım',
                value: `\`\`\`/qr [metin]\`\`\`QR kod üretir.\n\`\`\`/kısalt [link]\`\`\`\`\`\`/hesapla [islem]\`\`\`\`\`\`/şifre-üret\`\`\`Güçlü şifre (sana özel).\n\`\`\`/notlarım\`\`\`Kişisel not defteri.`
            },
            {
                name: '4. /emoji-büyüt & /mc-sunucu & /efekt & /hatırlat',
                value: `\`\`\`/emoji-büyüt [emoji]\`\`\`\`\`\`/mc-sunucu [adres]\`\`\`Sunucu durumu + oyuncu sayısı.\n\`\`\`/efekt [tur]\`\`\`Avatara filtre uygular.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    if (categoryKey === 'help_community') {
        const title = `Topluluk & Yardımcı Araçlar`;
        const desc = `Kullanıcı etkileşimi, profil araçları ve eğlenceli sunucu özellikleri:`;
        const fields = [
            {
                name: '1. /oneri & /itibar',
                value: `\`\`\`/oneri\`\`\`Üyelerin öneri gönderebileceği oylamalı öneri panelini açar.\n\`\`\`/itibar ver [kullanici: ZORUNLU]\`\`\`Kullanıcıya +rep takdir puanı verir.\n\`\`\`/itibar goruntule <kullanici: İSTEĞE BAĞLI>\`\`\`İtibar puanını görüntüler.`
            },
            {
                name: '2. /afk & /hatirlat & /cekilis',
                value: `\`\`\`/afk <sebep: İSTEĞE BAĞLI>\`\`\`AFK moduna geçer, sizi etiketleyenlere bilgi verir.\n\`\`\`/hatirlat [sure: ZORUNLU] [not: ZORUNLU]\`\`\`Belirtilen süre sonra size özel hatırlatma mesajı atar.\n\`\`\`/cekilis baslat\`\`\`Gelişmiş çekiliş başlatma panelini açar.`
            },
            {
                name: '3. /avatar & /banner & /spotify & /etkinlik & /oy-ver',
                value: `\`\`\`/avatar <kullanici: İSTEĞE BAĞLI>\`\`\`Kullanıcının profil fotoğrafını HD büyütür.\n\`\`\`/banner <kullanici: İSTEĞE BAĞLI>\`\`\`Kullanıcının profil afişini görüntüler.\n\`\`\`/spotify <kullanici: İSTEĞE BAĞLI>\`\`\`Kullanıcının o an dinlediği Spotify şarkısını gösterir.\n\`\`\`/etkinlik olustur\`\`\`Katılım butonlu etkinlik kartı.\n\`\`\`/oy-ver\`\`\`Oy ver, Jeton ödülü kazan.`
            }
        ];
        return createContainerMessage(title, desc, COLORS.PRIMARY || '#5865F2', [navMenu], fields, false);
    }

    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardım')
        .setDescription('Sistem yönetimi ve tüm komutlar hakkında bilgi almak için yardım panelini açar.')
        .setDMPermission(false),

    createHelpComponents,
    helpEmbedHome,
    getCategoryHelpPayload,

    async execute(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }
            const selectRow = createHelpComponents('home', interaction.member);
            const fullPayload = helpEmbedHome(interaction.guild, interaction.user, [selectRow], interaction.member);
            fullPayload.flags = MessageFlags.IsComponentsV2;
            await interaction.editReply(fullPayload);
        } catch (error) {
            console.error('Yardım komutu hatası:', error);
            throw error;
        }
    }
};
