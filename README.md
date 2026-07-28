# Turklion Moderasyon Botu

Bu depo (repository), Discord sunuculari icin gelistirilmis kapsamli, hizli ve profesyonel bir moderasyon botunu icerir.

## Ozellikler

- Gelismis Otomatik Moderasyon (Kufur, Reklam/Link, Etiket, Buyuk Harf filtreleri)
- Dinamik Uyari Sistemi (Uyari sayisina gore otomatik islem: Timeout, Kick, Ban)
- V2 Kullanici Arayuzu Destekli Denetim Kayitlari (Log sistemi)
- Optimize Edilmis Toplu Loglama (Spam onleyici grup loglama yapisi)
- Ticket (Destek) Sistemi
- Tamamen MariaDB/MySQL tabanli veritabani yonetimi

## Kurulum

1. Depoyu klonlayin.
2. Gerekli bagimliliklari yukleyin:
   `npm install`
3. Klasor icerisinde `.env` adinda bir dosya olusturun ve asagidaki bilgileri doldurun:
   ```
   DISCORD_TOKEN=sizin_bot_tokeniniz
   CLIENT_ID=bot_id_numarasi
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=veritabani_sifresi
   DB_NAME=discord_mod_bot
   ALLOWED_GUILDS=sunucu_id_1,sunucu_id_2
   ```
4. Veritabaninizi baslatin (MariaDB kullanmaniz tavsiye edilir).
5. Botun slash komutlarini Discord'a yuklemek icin calistirin:
   `node deploy-commands.js`
6. Botu baslatin:
   `node index.js`

## Mimari ve Guvenlik

Sistem, yorulmayan bir MariaDB havuzu uzerine (Connection Pool) insa edilmistir. Botun islem performansini dusurmemek adina sorgular optimize edilmis olup, veritabani darbozgazlarini onleyecek mimari kullanilmaktadir. Guvenlik acisindan, hardcoded id gibi hassas bilgiler sifrelenmis yontemler arkasinda calistirilmaktadir.
