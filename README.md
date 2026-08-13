# TurkLion Discord Moderation Bot

Gelişmiş bir Discord Moderasyon Botu. Tüm işlemler veritabanı (MariaDB) tabanlı çalışır ve ceza takip (mute, ban, uyarı) sistemleri otomatik olarak yönetilir. Kapsamlı loglama, rol hafızası (role memory) ve UI Components V2 özellikleri içerir.

## 🚀 Gereksinimler

Botu kendi sunucunuzda (VDS/VPS) çalıştırmak için aşağıdaki yazılımların kurulu olması gereklidir:

- **Node.js** (v18.0.0 veya üzeri)
- **MariaDB** (veya MySQL)
- **Redis** (Anti-spam sistemleri ve cache için)

## ⚙️ Kurulum Adımları

### 1. Dosyaları İndirin ve Bağımlılıkları Yükleyin

Proje dizinine gidin ve gerekli Node modüllerini kurun:

```bash
npm install
```

### 2. Veritabanı ve Redis Yapılandırması

Sisteminizde MariaDB ve Redis servislerinin çalıştığından emin olun:

```bash
# Servisleri başlatma (Linux/Ubuntu için)
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

MariaDB üzerinde bot için bir veritabanı oluşturun:
```sql
CREATE DATABASE discord_mod_bot;
```

### 3. Ortam Değişkenleri (.env)

Projenin ana dizininde bir `.env` dosyası oluşturun ve içerisine token ve veritabanı bilgilerinizi girin:

```env
DISCORD_TOKEN=BOTUNUZUN_TOKEN_BURAYA
CLIENT_ID=BOTUNUZUN_CLIENT_ID_BURAYA

DB_HOST=localhost
DB_USER=root
DB_PASS=Sifreniz
DB_NAME=discord_mod_bot

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Ayar Dosyası (config.json)

`config.json` içerisine sadece botun çalışmasına izin verdiğiniz sunucu ID'lerini ve yetkili (Kurucu/Sahip) hesabınızın ID'sini ekleyin:

```json
{
  "ALLOWED_GUILDS": ["SADECE_IZIN_VERILEN_SUNUCU_ID"],
  "SUPER_ADMIN_ID": "KENDI_DISCORD_ID_NIZ"
}
```

### 5. Slash Komutlarını Yükleme (Deploy)

Discord API'sine botun slash (/) komutlarını global olarak kaydetmek için aşağıdaki komutu çalıştırın. **(Bot sunucuya eklendiğinde komutların görünmesi için bu işlemi bir kez yapmanız şarttır!)**

```bash
node deploy-commands.js
```

## 🛠️ Botu Başlatma

Botu normal şekilde başlatmak için, tüm veritabanı tablolarını (`guild_config`, `warnings`, `mutes`, `role_memory`, vs.) otomatik kuran ana dosyayı çalıştırın:

```bash
node starter.js
```

Eğer botu arkaplanda, terminal kapansa bile çalışacak şekilde başlatmak istiyorsanız (PM2 önerilir):

```bash
# PM2 kurma (Eğer yoksa)
npm install -g pm2

# Botu PM2 ile arkaplanda başlatma
pm2 start starter.js --name "ModBot"

# Botun başlangıçta otomatik çalışmasını sağlama
pm2 save
pm2 startup
```

## 📋 Önemli Modüllerin İşleyişi
- **Rol Hafızası (`utils/roleMemory.js`):** Üyelere mute veya ban atıldığında orijinal rollerini (VIP vb.) yedeğe alır ve süre bittiğinde otomatik geri verir. Üst üste cezalarda (ghost role sorunu) rolleri birbirine karıştırmadan akıllıca birleştirir.
- **Süre Denetleyici (`utils/muteChecker.js` & `utils/warningManager.js`):** Saniye saniye ceza sürelerini (Mute, Uyarı vs) kontrol eder, süresi dolanları kaldırır ve rolleri günceller.
- **Güvenlik (`utils/permissions.js`):** Mod veya Adminlerin kendilerinden üst yetkideki kişilere ceza vermesini engeller. Sadece `config.json`'da belirlenen `SUPER_ADMIN_ID` tüm hiyerarşiyi aşabilir.
