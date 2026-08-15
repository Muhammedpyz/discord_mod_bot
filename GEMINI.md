# ANTIGRAVITY KESİN VE DEĞİŞTİRİLEMEZ KURALLAR (STRICT SYSTEM RULES)

Bu proje genelinde çalışan tüm yapay zeka ajanları (Antigravity) aşağıdaki kurallara **İSTİSNASIZ** uymak zorundadır:

---

## 🚫 KURAL 1: KESİNLİKLE STANDART / KLAVYE EMOJİSİ KULLANILAMAZ
1. Discord arayüzlerinde (butonlar, mesajlar, menüler, container'lar, loglar vb.) standart telefon/klavye/unicode emojileri (örneğin ⚙️, 📁, 🛡️, 💬, 🔄, 🔒, 📝, ❌, ✅ vb.) KESİNLİKLE YASAKTIR.
2. Tüm emojiler SADECE ve YALNIZCA `/root/discord_mod_bot/utils/uiBuilder.js` içerisindeki `MONO_EMOJIS` sözlüğünde tanımlı olan özel ID'li mono emojiler (`<:mono:${MONO_EMOJIS.key}>` veya butonlarda `.setEmoji(MONO_EMOJIS.key)`) kullanılarak eklenecektir.

---

## 🖼️ KURAL 2: DAİMA COMPONENTS V2 VE CONTAINERBUILDER KULLANILACAKTIR
1. Tüm Discord komut yanıtları, panelleri, hata mesajları ve bildirimleri Discord Components V2 (`ContainerBuilder`, `TextDisplayBuilder`, `SectionBuilder`, `SeparatorBuilder`) formatında oluşturulacaktır.
2. Eski V1 Embed veya düz metin mesajları KULLANILMAYACAKTIR. Yanıtlar daima `uiBuilder.js` içindeki `createContainerMessage` veya `buildModBResponse` fonksiyonları üzerinden `MessageFlags.IsComponentsV2` bayrağı ile gönderilecektir.

---

## 🔒 KURAL 3: İZİNSİZ KOD/KOMUT SİLİNEMEZ
1. Kullanıcının açık ve net talimatı olmadan hiçbir komut, dosya, klasör veya veritabanı tablosu silinemez.
2. Mevcut çalışan mimari ve klasör yapısı daima korunacaktır.

---

## ⏱️ KURAL 4: DİSCORD ETKİLEŞİM VE ZAMAN AŞIMI (TIMEOUT / 3 SANİYE) KURALI
1. Discord 3 saniyelik yanıt süresi sınırı koyar. Modal açmayacak TÜM buton, menü ve modal submit işlemlerinde ilk satırda MUTLAKA `await interaction.deferUpdate()` veya `await interaction.deferReply({ flags: MessageFlags.Ephemeral })` çağrılmalıdır.
2. Discord Modal pencereleri (`ModalBuilder`) Discord API gereği YALNIZCA `TextInputBuilder` (type: 4) bileşenlerini kabul eder. Modallar içine asla SelectMenu konulamaz (Error 50035 hatası verir).
3. `MessageFlags` tüm etkileşim ve komut dosyalarında `const { MessageFlags } = require('discord.js');` şeklinde daima en başta eksiksiz import edilmiş olmalıdır.

---

## 📸 KURAL 5: EKRAN GÖRÜNTÜSÜ / SS İNCELEME KURALI
1. Kullanıcı ekran görüntüsü ("ss bak", "resimlere bak", "ss aldım", "ekran görüntüsü" vb.) talep ettiğinde asistan MUTLAKA doğrudan cihazdaki `/storage/emulated/0/DCIM/Screenshots/` klasöründeki en son ekran görüntülerini (en az son 10 SS) inceleyecek ve oradaki görsellere göre hareket edecektir.
