# Bot + Mariadb Başlatma Komutları

## 1. Mariadb başlat
nohup /data/data/com.termux/files/usr/bin/mariadbd --user=root --datadir=/data/data/com.termux/files/usr/var/lib/mysql --socket=/data/data/com.termux/files/usr/var/run/mysqld/mysqld.sock --port=3306 > /tmp/mariadb.log 2>&1 &

## 2. Bot başlat
nohup /root/discord_mod_bot/run_bot.sh > /dev/null 2>&1 &

## 3. Kontrol
ps aux | grep -E "mariadbd|node index" | grep -v grep

## Notlar
- Bot: /root/discord_mod_bot (index.js, run_bot.sh otomatik yeniden başlatır)
- DB: 127.0.0.1:3306, kullanıcı root, şifresiz, veritabanı discord_mod
- Loglar: /root/discord_mod_bot/bot.log
- Socket eski/kilitliyse: rm -f /data/data/com.termux/files/usr/var/run/mysqld/mysqld.sock