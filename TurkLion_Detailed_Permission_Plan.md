# TurkLion Network - Kapsamlı Rol ve Kanal İzin Planı (Öneri Raporu)

Bu rapor, sunucudaki tüm rollerin ve tüm kanalların siber güvenlik ve sunucu düzeni açısından **olması gereken** detaylı izin şemasını barındırır. Diğer yapay zeka asistanlarına danışabilmeniz için özel olarak hazırlanmıştır.

## 1. ROLLER VE KÜRESEL (SUNUCU) İZİNLERİ

Aşağıdaki liste sunucudaki tüm rolleri ve onların "Sunucu Ayarları -> Roller" kısmında sahip olması gereken ana yetkilerini listeler:

- **Role Adı:** `@everyone`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `Yönetici`
  - **Önerilen Ana İzinler:** **SADECE Administrator (Yönetici)** yetkisi açık olmalı. (Geri kalan hiçbir şeye gerek yok).

- **Role Adı:** `Geliştirici`
  - **Önerilen Ana İzinler:** **SADECE Administrator (Yönetici)** yetkisi açık olmalı. (Geri kalan hiçbir şeye gerek yok).

- **Role Adı:** `Ekosistem`
  - **Önerilen Ana İzinler:** **Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).

- **Role Adı:** `Moderatör`
  - **Önerilen Ana İzinler:** **Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).

- **Role Adı:** `Discord Moderatör`
  - **Önerilen Ana İzinler:** **Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).

- **Role Adı:** `LVIP+`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `LVIP`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `VIP+`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `VIP`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `Oyuncu`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `Asistan`
  - **Önerilen Ana İzinler:** **Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).

- **Role Adı:** `Yardımcı`
  - **Önerilen Ana İzinler:** **Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).

- **Role Adı:** `SVIP`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `MVIP`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `Mimar`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `🦁`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `GOD`
  - **Önerilen Ana İzinler:** **SADECE Administrator (Yönetici)** yetkisi açık olmalı. (Geri kalan hiçbir şeye gerek yok).

- **Role Adı:** `The Türklions.`
  - **Önerilen Ana İzinler:** **SADECE Administrator (Yönetici)** yetkisi açık olmalı. (Geri kalan hiçbir şeye gerek yok).

- **Role Adı:** `Server Booster`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `Bots`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `ULTRA`
  - **Önerilen Ana İzinler:** Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.

- **Role Adı:** `yeni rol`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `Medya Sorumlusu`
  - **Önerilen Ana İzinler:** **Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).

- **Role Adı:** `yeni rol`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `Nyx`
  - **Önerilen Ana İzinler:** Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).

- **Role Adı:** `Uyarı`
  - **Önerilen Ana İzinler:** **HİÇBİR YETKİ YOK.** Bütün yetki kutucukları boş (kapalı) olmalı.

- **Role Adı:** `Uyarı 2`
  - **Önerilen Ana İzinler:** **HİÇBİR YETKİ YOK.** Bütün yetki kutucukları boş (kapalı) olmalı.

- **Role Adı:** `Ban`
  - **Önerilen Ana İzinler:** **HİÇBİR YETKİ YOK.** Bütün yetki kutucukları boş (kapalı) olmalı.


## 2. KANALLAR VE KANAL BAZLI ÖZEL İZİNLER (OVERWRITES)

Aşağıda sunucudaki HER BİR KANAL ve o kanalda hangi rolün hangi izne sahip olması gerektiği (Allow/Deny) detaylıca listelenmiştir:

### Kanal: `📦・skyblock-ticaret` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Lobi` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `yetkili-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `📺・youtuber-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: KAPALI (Deny)`
- **VIP Rolleri (Tümü):** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `mesaj-logları` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `📜・ekip-tanıtım` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📺 | Yayın Odası 1` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Hesap Eşle` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `güvenlik-logları` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `📦・factions-ticaret` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `AFK` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Yönetim` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `OZEL ODALAR` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `hatalar` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `🤖・uygulama-komutları` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `oda-olustur` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Ticaret Merkezi` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `yapılcaklar-liste` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `⛔ | Personel harici giremez` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `🔗・youtuber-başvuru` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: KAPALI (Deny)`
- **VIP Rolleri (Tümü):** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `Merkez` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📷・fotoğraf-galerisi` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `ses-logları` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `discord-mod-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `yetkili-duyuru` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `forum` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `💎・vip-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: KAPALI (Deny)`
- **VIP Rolleri (Tümü):** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `📺 | Yayın Odası 2` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `🔉 | Sesli Sohbet 1` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📣・duyuru` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: KAPALI (Deny)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `💤 | Uzakta` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📦・survival-ticaret` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `🥇・seviyeler` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Personel` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `toplantı-özet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `Sesli Sohbet` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `ticket-log` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `🔗・hesap-eşle` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `👋・arkadaş-arama` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `🔉 | Sesli Sohbet 2` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📈・sıralama-bilgi` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: KAPALI (Deny)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Başvurular` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `🏦 | Toplantı odası` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `üst-yönetim-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `DESTEK TALEPLERI` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `yüksek-güvenlikli-oda` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `ticket-olustur` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Yayın Odası` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `eşleme-logları` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `server-önerileri` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `🔧 | Yetkili Sohbet` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `💡・oylama` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `plan` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `🎉・çekiliş` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `🔉 | Sesli Sohbet 3` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Oda Olustur` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `mimar-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `🎨・tasarım-paylaşım` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📣・ön-izleme` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `💻 | Geliştirme ofisi` (Tipi: Ses Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu & VIP'ler:** `Görüntüleme: KAPALI (Deny)`
- **Moderatör / Asistan / Yardımcı:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`

### Kanal: `giriş-çıkış` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: KAPALI (Deny)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `Sosyal` (Tipi: Kategori)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `📰・kurallar` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: KAPALI (Deny)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`

### Kanal: `💭・genel-sohbet` (Tipi: Metin Kanalı)
**Bu Kanalda Olması Gereken İzin Ayarları:**
- **@everyone & Oyuncu:** `Görüntüleme: AÇIK (Allow)`, `Mesaj Gönder: AÇIK (Allow)`
- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)
- **Ban / Ceza Rolleri:** `Görüntüleme: KAPALI (Deny)`, `Mesaj Gönder: KAPALI (Deny)`


---
**Not:** "Üst Yönetim (Yönetici, GOD, Geliştirici)" rollerinde 'Yönetici (Administrator)' yetkisi açık olduğu için hiçbir kanalda onlara özel Allow/Deny ayarı yapılmasına gerek yoktur, her yeri otomatik görürler.
**Rol Hafızası Notu:** Banned (Karantina) veya Mute yiyen kullanıcıların diğer tüm rolleri (Oyuncu, VIP vb.) geçici olarak ellerinden alınmalıdır ki, o rollerin yeşil tikleri Ceza rollerinin kırmızı çarpısını ezmesin.
