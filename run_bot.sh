#!/bin/bash
cd /root/discord_mod_bot
while true; do
    echo "[$(date '+%H:%M:%S')] Bot başlatılıyor..." >> /root/discord_mod_bot/bot.log
    node index.js >> /root/discord_mod_bot/bot.log 2>&1
    EXIT_CODE=$?
    echo "[$(date '+%H:%M:%S')] Bot çıktı! Exit kodu: $EXIT_CODE" >> /root/discord_mod_bot/bot.log
    if [ "$EXIT_CODE" -eq 0 ]; then
        echo "Düzgün çıkış - yeniden başlatılmayacak" >> /root/discord_mod_bot/bot.log
        break
    fi
    sleep 5
done