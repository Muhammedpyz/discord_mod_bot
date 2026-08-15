const { MONO_EMOJIS } = require('./uiBuilder');

const LOG_CATEGORIES = {
    message: {
        id: 'message',
        name: 'Mesaj',
        emojiKey: 'file_text',
        emojiFallback: '1537768125544538112',
        description: 'Silinen, düzenlenen ve sabitlenen mesajlar',
        events: [
            { id: 'msg_delete', name: 'Mesaj Silme', desc: 'Kullanıcı veya yetkili tarafından silinen mesajlar' },
            { id: 'msg_edit', name: 'Mesaj Düzenleme', desc: 'Eski ve yeni mesaj içeriği karşılaştırması' },
            { id: 'msg_bulk_delete', name: 'Toplu Mesaj Silme', desc: 'Clear/temizle komutu ile silinen mesajlar' },
            { id: 'msg_pin', name: 'Mesaj Sabitleme', desc: 'Kanala sabitlenen veya kaldırılan mesajlar' }
        ]
    },
    member: {
        id: 'member',
        name: 'Üye',
        emojiKey: 'user',
        emojiFallback: '1537768132062486558',
        description: 'Rol değişimleri, takma ad, kullanıcı adı ve avatar hareketleri',
        events: [
            { id: 'member_join', name: 'Sunucuya Giriş', desc: 'Yeni üyenin sunucuya katılması' },
            { id: 'member_leave', name: 'Sunucudan Ayrılma', desc: 'Üyenin sunucudan ayrılması' },
            { id: 'member_role_add', name: 'Rol Verilme', desc: 'Üyeye yeni bir rol verilmesi (Yetkili bilgisi ile)' },
            { id: 'member_role_remove', name: 'Rol Alınma', desc: 'Üyeden rol alınması (Yetkili bilgisi ile)' },
            { id: 'member_nick_change', name: 'Takma Ad Değişimi', desc: 'Sunucu içi takma ad (nickname) değişimi' },
            { id: 'user_name_change', name: 'Kullanıcı Adı Değişimi', desc: 'Genel Discord kullanıcı adı değişimi' },
            { id: 'user_avatar_change', name: 'Avatar Değişimi', desc: 'Kullanıcı profil fotoğrafı değişimi' }
        ]
    },
    ban: {
        id: 'ban',
        name: 'Yasaklama',
        emojiKey: 'ban',
        emojiFallback: '1530917533081927780',
        description: 'Sunucudan yasaklanan ve yasağı kaldırılan üyeler',
        events: [
            { id: 'ban_add', name: 'Yasaklama (Ban)', desc: 'Sunucudan kalıcı olarak yasaklanan üyeler' },
            { id: 'ban_remove', name: 'Yasak Kaldırma (Unban)', desc: 'Yasağı kaldırılan üyeler' }
        ]
    },
    kick: {
        id: 'kick',
        name: 'Atma',
        emojiKey: 'kick',
        emojiFallback: '1530918797437833356',
        description: 'Sunucudan atılan (kicklenen) üyeler',
        events: [
            { id: 'member_kick', name: 'Sunucudan Atma (Kick)', desc: 'Yetkili tarafından atılan üyeler' }
        ]
    },
    mute: {
        id: 'mute',
        name: 'Susturma',
        emojiKey: 'volume_x',
        emojiFallback: '1537768182868082708',
        description: 'Metin ve ses susturma (mute/timeout) cezaları',
        events: [
            { id: 'text_mute', name: 'Metin Susturma (Mute/Timeout)', desc: 'Metin kanallarında susturulan üyeler' },
            { id: 'voice_mute', name: 'Ses Susturma (Ses Mute)', desc: 'Ses kanallarında susturulan üyeler' }
        ]
    },
    warn: {
        id: 'warn',
        name: 'Uyarı',
        emojiKey: 'warning',
        emojiFallback: '1530917524609175562',
        description: 'Yetkililer tarafından verilen veya sıfırlanan uyarılar',
        events: [
            { id: 'warn_add', name: 'Uyarı Verme (Warn)', desc: 'Ceza siciline işlenen uyarılar' },
            { id: 'warn_reset', name: 'Uyarı Sıfırlama', desc: 'Üyenin uyarılarının sıfırlanması' }
        ]
    },
    channel_ops: {
        id: 'channel_ops',
        name: 'Kanal İşlemleri',
        emojiKey: 'delete',
        emojiFallback: '1530918957349867711',
        description: 'Kanal oluşturma, silme ve yapılandırma',
        events: [
            { id: 'channel_create', name: 'Kanal Oluşturma', desc: 'Yeni metin, ses veya kategori açılması' },
            { id: 'channel_delete', name: 'Kanal Silme', desc: 'Silinen kanallar ve silen yetkili' },
            { id: 'channel_update', name: 'Kanal Düzenleme', desc: 'İsim, kategori, yavaş mod ve başlık değişimi' }
        ]
    },
    automod: {
        id: 'automod',
        name: 'AutoMod',
        emojiKey: 'shield',
        emojiFallback: '1530917506867400775',
        description: 'Küfür, reklam, spam ve caps koruması ihlalleri',
        events: [
            { id: 'automod_swear', name: 'Küfür Filtresi Engeli', desc: 'Küfür veya argo içeren mesajların engellenmesi' },
            { id: 'automod_link', name: 'Reklam / Link Engeli', desc: 'İzinsiz bağlantı ve davet linki engeli' },
            { id: 'automod_spam', name: 'Spam & CapsLock Engeli', desc: 'Seri mesaj veya büyük harf ihlali tespiti' }
        ]
    },
    channel: {
        id: 'channel',
        name: 'Kanal',
        emojiKey: 'sliders',
        emojiFallback: '1537770137136922694',
        description: 'Kanal izinleri ve özel yapılandırmaları',
        events: [
            { id: 'channel_perms', name: 'Kanal İzin Değişimi', desc: 'Kanal rol ve üye izinlerinin güncellenmesi' },
            { id: 'channel_topic', name: 'Kanal Konusu Değişimi', desc: 'Kanal açıklama ve konusunun değişmesi' },
            { id: 'channel_nsfw', name: 'Yaş Sınırı (NSFW)', desc: 'NSFW modunun açılması veya kapatılması' },
            { id: 'channel_bitrate', name: 'Ses Kalitesi (Bitrate)', desc: 'Ses kanalı bitrate veya kullanıcı limiti değişimi' }
        ]
    },
    role: {
        id: 'role',
        name: 'Rol',
        emojiKey: 'crown',
        emojiFallback: '1530918952711094272',
        description: 'Rol oluşturma, silme, renk, yetki ve hiyerarşi',
        events: [
            { id: 'role_create', name: 'Rol Oluşturma', desc: 'Yeni rol açılması ve oluşturan yetkili' },
            { id: 'role_delete', name: 'Rol Silme', desc: 'Silinen roller ve silen yetkili' },
            { id: 'role_update', name: 'Rol İsim / Renk Değişimi', desc: 'Rol adı, rengi veya simgesinin değişmesi' },
            { id: 'role_perms', name: 'Rol Yetki Değişimi', desc: 'Yönetici veya kritik yetkilerin değişimi' },
            { id: 'role_order', name: 'Rol Sıralaması', desc: 'Rol hiyerarşisinin ve pozisyonunun değişimi' }
        ]
    },
    voice: {
        id: 'voice',
        name: 'Ses',
        emojiKey: 'volume_2',
        emojiFallback: '1537768210772795452',
        description: 'Ses kanallarına giriş, çıkış, taşıma ve susturma',
        events: [
            { id: 'voice_join', name: 'Sese Katılma', desc: 'Kullanıcının bir ses kanalına bağlanması' },
            { id: 'voice_leave', name: 'Sesten Ayrılma', desc: 'Kullanıcının ses kanalından çıkması' },
            { id: 'voice_move', name: 'Oda Değiştirme (Taşıma)', desc: 'Başka bir ses odasına geçiş veya taşınma' },
            { id: 'voice_self_mute', name: 'Kendi Mute / Sağırlaştırma', desc: 'Mikrofon veya kulaklık kapatıp açma' },
            { id: 'voice_server_mute', name: 'Yetkili Tarafından Susturma', desc: 'Sunucu mikrofon veya kulaklık susturması' },
            { id: 'voice_stream', name: 'Ekran Paylaşımı & Kamera', desc: 'Yayın açma veya kamera başlatma' }
        ]
    },
    guild: {
        id: 'guild',
        name: 'Sunucu',
        emojiKey: 'settings',
        emojiFallback: '1530917511711948903',
        description: 'Sunucu adı, ikonu, bannerı, emoji ve webhook hareketleri',
        events: [
            { id: 'guild_update', name: 'Sunucu Ayarları Değişimi', desc: 'Sunucu adı, açıklaması veya güvenlik düzeyi' },
            { id: 'guild_icon', name: 'İkon / Banner Değişimi', desc: 'Sunucu profil fotoğrafı veya banner güncellemesi' },
            { id: 'emoji_create', name: 'Emoji Ekleme', desc: 'Yeni emoji yüklenmesi' },
            { id: 'emoji_delete', name: 'Emoji Silme', desc: 'Mevcut emojinin silinmesi' },
            { id: 'emoji_update', name: 'Emoji İsmi Değişimi', desc: 'Emoji adının güncellenmesi' },
            { id: 'sticker_ops', name: 'Çıkartma (Sticker) İşlemleri', desc: 'Sticker ekleme veya silme' },
            { id: 'webhook_ops', name: 'Webhook İşlemleri', desc: 'Webhook oluşturma, silme veya yetkilendirme' },
            { id: 'boost_level', name: 'Boost & Takviye Seviyesi', desc: 'Sunucuya boost basılması veya seviye değişimi' },
            { id: 'vanity_update', name: 'Özel URL (Vanity) Değişimi', desc: 'Sunucunun özel davet linki değişimi' }
        ]
    },
    thread: {
        id: 'thread',
        name: 'Konu (Thread)',
        emojiKey: 'message_square',
        emojiFallback: '1537768184851996702',
        description: 'Metin ve forum kanallarında açılan alt konular',
        events: [
            { id: 'thread_create', name: 'Konu Açma', desc: 'Yeni thread/konu başlatılması' },
            { id: 'thread_delete', name: 'Konu Silme', desc: 'Thread/konunun silinmesi' },
            { id: 'thread_update', name: 'Konu Kilitleme / Arşivleme', desc: 'Thread kilitlenmesi veya arşivlenmesi' }
        ]
    },
    invite: {
        id: 'invite',
        name: 'Davet',
        emojiKey: 'invite',
        emojiFallback: '1530917543491932196',
        description: 'Oluşturulan ve silinen sunucu davet linkleri',
        events: [
            { id: 'invite_create', name: 'Davet Oluşturma', desc: 'Yeni bir davet bağlantısı üretilmesi' },
            { id: 'invite_delete', name: 'Davet Silme', desc: 'Davet bağlantısının silinmesi veya süresinin dolması' }
        ]
    }
};

const ALL_EVENTS = Object.values(LOG_CATEGORIES).flatMap(c => c.events.map(e => ({ ...e, category: c.id })));
const TOTAL_EVENTS_COUNT = ALL_EVENTS.length; // 51
const TOTAL_CATEGORIES_COUNT = Object.keys(LOG_CATEGORIES).length; // 14

module.exports = {
    LOG_CATEGORIES,
    ALL_EVENTS,
    TOTAL_EVENTS_COUNT,
    TOTAL_CATEGORIES_COUNT
};
