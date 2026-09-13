import { Bot, Sparkles, Shield, Music, Zap, MessageSquare, Globe, Lock, Award, Ticket, Gift, Radio, Volume2, UserCheck, Settings } from "lucide-react";

export const siteConfig = {
  brand: {
    domain: "https://nyxbot.app",
    bannerUrl: "",
    logoUrl: "/favicon.png",
  },

  bot: {
    name: "Nyx",
    tagline: "Gelişmiş All-in-One Discord Yönetim & Güvenlik Sistemi",
    description:
      "Nyx; MariaDB ve Redis altyapılı, gelişmiş ceza takibi, role memory (rol koruması), 14 kategorili loglama, müzik, bilet ve özel oda sistemlerine sahip profesyonel Discord botudur.",
    version: "v1.0.0",
    servers: "4",
    users: "150+",
    commands: 173,
    uptime: "%99.9",
    inviteUrl: "https://discord.com/oauth2/authorize?client_id=1176622088837148732&permissions=8&integration_type=0&scope=bot+applications.commands",
    supportUrl: "https://discord.gg/ymrEJTjqJ3",
  },

  nav: [
    { label: "Ana Sayfa", href: "/" },
    { label: "Komutlar", href: "/commands" },
    { label: "Rehber", href: "/docs" },
    { label: "Yenilikler", href: "/changelog" },
    { label: "Hakkında", href: "/about" },
  ],

  features: [
    {
      icon: Shield,
      title: "Gelişmiş Moderasyon & Ceza Sistemi",
      description:
        "Otomatik ceza takibi (Ban, Mute, VMute, Warn, Softban) ve veritabanı (MariaDB/Redis) entegrasyonu ile sunucunuz 7/24 güvende.",
    },
    {
      icon: Lock,
      title: "Rol Hafızası (Role Memory)",
      description:
        "Cezalı üyelerin orijinal rollerini (VIP, yetkili vb.) kaydeder ve ceza bitiminde eksiksiz geri yükler.",
    },
    {
      icon: Music,
      title: "Kesintisiz Müzik & Filtreler",
      description:
        "Spotify ve YouTube destekli yüksek kaliteli müzik çalma, ekolayzır filtreleri ve 7/24 ses odasında kalma desteği.",
    },
    {
      icon: Radio,
      title: "Özel (Geçici) Odalar",
      description:
        "Kullanıcıların kendi ses ve metin odalarını oluşturup limit, isim ve kilit ayarlarını yönetebileceği gelişmiş sistem.",
    },
    {
      icon: Ticket,
      title: "Destek Bilet (Ticket) Sistemi",
      description:
        "Kategori bazlı bilet açma, transcript (sohbet kaydı) alma ve yetkili atama modülü.",
    },
    {
      icon: Gift,
      title: "Çekiliş & Seviye (XP) Sistemi",
      description:
        "Zamanlamalı çekilişler, üye seviye kartları, Minecraft skin sorgulama ve sunucu liderlik tabloları.",
    },
  ],

  // Static fallback kaldırıldı, tüm komutlar /api/stats'tan tamamen canlı ve dinamik çekilir
  commandCategories: [],

  team: [
    {
      name: "Muhammedpyz",
      role: "Geliştirici & Sistem Mimarı",
      bio: "Nyx geliştiricisi. Discord.js v14, MariaDB ve Redis altyapısını yönetmektedir.",
      avatar: "/favicon.png",
      socials: { github: "https://github.com/muhammedpyz", twitter: "https://twitter.com" },
    },
  ],

  faqs: [
    {
      q: "Nyx tamamen ücretsiz mi?",
      a: "Evet, tüm moderasyon, müzik, bilet ve özel oda özellikleri tamamen ücretsizdir.",
    },
    {
      q: "Botu sunucuma nasıl ekleyebilirim?",
      a: "Sitede bulunan 'Nyx'i Sunucuna Ekle' butonuna tıklayıp gerekli izinleri onaylayarak birkaç saniye içinde ekleyebilirsiniz.",
    },
    {
      q: "Verilerimiz nasıl saklanıyor?",
      a: "Yalnızca ceza kayıtları, sunucu ayarları ve rol hafızası MariaDB veritabanımızda güvenli bir şekilde saklanır. Sohbet mesajlarınız asla kaydedilmez.",
    },
    {
      q: "Botun uptime süresi nedir?",
      a: "Botumuz yedekli sunucularda 7/24 kesintisiz %99.9 Uptime oranı ile hizmet vermektedir.",
    },
    {
      q: "Kaç tane komut var?",
      a: "Şu anda 173+ komut 12 farklı kategoride aktif olarak hizmet vermektedir. Komutlar sayfasından tümüne göz atabilirsiniz.",
    },
    {
      q: "Web panelinden neler yapılabilir?",
      a: "AutoMod, Anti-Nuke, Log Kanalları, Bilet, Çekiliş, Öneri, Özel Komutlar, Ekonomi, Starboard ve daha fazlasını web panelinden yönetebilirsiniz.",
    },
  ],

  contact: {
    email: "destek@nyx.bot",
    discord: "https://discord.gg/ymrEJTjqJ3",
    github: "https://github.com/muhammedpyz",
    twitter: "https://twitter.com",
  },

  socials: [
    { icon: Globe, href: "https://nyxbot.app", label: "Web" },
    { icon: MessageSquare, href: "https://discord.gg/ymrEJTjqJ3", label: "Discord" },
  ],

  privacy: {
    lastUpdated: "13 Eylül 2026",
    sections: [
      {
        title: "Toplanan Bilgiler",
        body: "Botun düzgün çalışabilmesi için yalnızca sunucu ID'leri, kanal ID'leri, rol ID'leri, ceza kayıtları ve yapılandırma tercihleri saklanır. Mesaj içerikleri kesinlikle saklanmaz.",
      },
      {
        title: "Verilerin Kullanımı",
        body: "Toplanan veriler sadece rol hafızası, ceza takip sistemleri, otomatik rol ve özelleştirilmiş bot ayarlarınızı sürdürmek için kullanılır. Üçüncü taraflarla paylaşılmaz.",
      },
      {
        title: "Veri Silme Hakkı",
        body: "Bot sunucunuzdan çıkarıldığında veya destek sunucumuz üzerinden talep ettiğinizde sunucunuza ait veriler tamamen temizlenir.",
      },
    ],
  },

  terms: {
    sections: [
      {
        title: "Kullanım Koşulları",
        body: "Botu kullanarak hizmet şartlarına ve Discord Topluluk Kurallarına uymayı kabul edersiniz. Kötüye kullanım tespiti durumunda bot erişimi kısıtlanabilir.",
      },
      {
        title: "Hizmet Sürekliliği",
        body: "%99.9 Uptime garantisi hedeflenmekle birlikte, beklenmeyen altyapı kesintilerinden kaynaklı durumlarda bot yönetimi sorumluluk kabul etmez.",
      },
    ],
  },

  changelog: [
    {
      version: "v1.3.0",
      date: "14 Eylül 2026",
      tag: "Tüm Komutlar Web Sitesine Entegre Edildi",
      highlights: [
        "173+ komut 12 farklı kategoride web sitesine ve paneline eksiksiz entegre edildi.",
        "Eğlence & Oyunlar kategorisi (25 komut): /kelime-oyunu, /adam-asmaca, /xox, /düello, /taş-kağıt-makas, /sayı-tahmin, /espri, /zar, /zar-düello, /hack, /ters-çevir ve daha fazlası.",
        "Ekonomi & Casino kategorisi (14 komut): /rulet, /crash, /blackjack, /slots, /balık-tut, /çalış, /suç-işle, /dilen, /saatlik, /hediye, /para-ver, /para-al, /ekonomi, /market-yonet.",
        "Sosyal & Aile sistemi (12 komut): /evlen, /boşan, /ailem, /evlat-edin, /evlatlıktan-red, /profil, /notlarım, /hakkımda, /basarim, /dogumgunu, /sosyal-medya, /spotify.",
        "Gelişmiş Araçlar & Entegrasyonlar: /hava-durumu, /döviz, /kripto, /çeviri, /şifre-üret, /qr, /hesapla, /wikipedia, /github, /npm, /emoji-büyüt.",
        "Oyun Entegrasyonları (4 komut): /mc, /mc-sunucu, /roblox, /steam.",
        "Tüm çoklu komut modülleri dinamik API tarayıcısına ve static fallback katmanına dahil edildi."
      ]
    },
    {
      version: "v1.2.0",
      date: "13 Eylül 2026",
      tag: "Büyük Güncelleme",
      highlights: [
        "127+ komut 11 farklı kategoride: Moderasyon, Müzik, Ekonomi & Market, Topluluk Araçları, Sosyal & Profil, Oyun Entegrasyonları, Seviye & Sıralama, Hatırlatıcı & Görevler ve daha fazlası.",
        "Ekonomi & Market sistemi eklendi: /ekonomi ile günlük maaş, balık tutma, blackjack, slot, çalışma, suç işleme ve market altyapısı.",
        "Buton Rol (/buton-rol) sistemi: Üyelerin butona tıklayarak rol alıp çıkarabilmesini sağlayan gelişmiş panel.",
        "Starboard (Yıldız Tablosu) sistemi: Beğenilen mesajların otomatik öne çıkarılması.",
        "Doğum Günü Kutlama sistemi: Üyelerin doğum günlerini kaydetmesi ve otomatik kutlama mesajı.",
        "Anket sistemi (/anket): Çoktan seçmeli ve süreli anket oluşturma.",
        "Sosyal Medya bağlantı sistemi: Discord profilinize sosyal medya hesaplarınızı bağlama.",
        "Hatırlatıcı sistemi (/hatirlat): Kişisel zamanlanmış hatırlatıcılar.",
        "Yapışkan Mesaj (/yapiskan): Kanallarda sabitlenmiş kalıcı mesaj sistemi.",
        "Özel Komut (/ozel-komut): Sunucu sahiplerinin kendi özel trigger-response komutlarını oluşturması.",
        "Web sitesi komut sayfası tamamen dinamik hale getirildi: Bot klasöründeki tüm komutlar anlık taranıyor.",
        "Web paneline 'Ekstra Sistemler' sekmesi eklendi: Starboard, Doğum Günü, Ekonomi ve Yapışkan Mesaj yönetimi.",
        "Özel Komutlar paneline Canlı Discord Önizlemesi (Live Preview) eklendi: Gerçek kullanıcı adı, sunucu adı ve üye sayısıyla birebir simülasyon."
      ]
    },
    {
      version: "v1.1.0",
      date: "13 Eylül 2026",
      tag: "Panel Entegrasyonu",
      highlights: [
        "Web Dashboard OAuth2 giriş sistemi kuruldu ve ISP bypass (proxy) desteği eklendi.",
        "15+ modüllü tam teşekküllü web yönetim paneli: AutoMod, Anti-Nuke, Ceza Kaydı, Bilet, Çekiliş, Öneri, Karşılama, Log Kanalları.",
        "Kullanıcı Sicil & Sorgu paneli: Web üzerinden kullanıcı geçmişi, ceza kayıtları ve moderatör notları görüntüleme.",
        "Canlı Discord mesaj önizleme motoru: {user}, {server}, {channel}, {membercount} değişkenleri gerçek sunucu verileriyle çalışıyor.",
        "Frontend pixel-pixel loglama altyapısı: Tüm tıklamalar ve hatalar /api/logs/frontend endpoint'ine kaydediliyor.",
        "Eğlence komutları eklendi: /8ball, /adam-asmaca, /aşk-ölçer, /düello, /espri, /gif, /kelime-oyunu, /sayı-tahmin, /xox, /yazı-tura, /zar ve daha fazlası."
      ]
    },
    {
      version: "v1.0.0",
      date: "12 Eylül 2026",
      tag: "İlk Yayın",
      highlights: [
        "Discord Components V2 (ContainerBuilder, SectionBuilder) mimarisine tam geçiş yapıldı.",
        "Rol Hafızası (Role Memory) entegrasyonu ile mute/ban sonrası orijinal rollerin geri yüklenmesi sağlandı.",
        "14 farklı kategoride 51 farklı olay için canlı veritabanı (MariaDB & Redis) loglama altyapısı kuruldu.",
        "Spotify, YouTube ve SoundCloud yüksek kaliteli müzik modülü ve ekolayzır filtreleri aktifleştirildi.",
        "Web sitesi canlı Discord API entegrasyonu ve dinamik komut tarayıcısı ile yayına alındı."
      ]
    },
    {
      version: "v0.9.5",
      date: "28 Ağustos 2026",
      tag: "Beta",
      highlights: [
        "AutoMod spam ve reklam koruması Redis cache desteği ile hızlandırıldı.",
        "Özel geçici ses ve metin odaları kontrol paneli (/odapanel) eklendi.",
        "Bilet (Ticket) destek modülüne HTML transcript kaydı alma seçeneği getirildi."
      ]
    }
  ],
};

export type SiteConfig = typeof siteConfig;
