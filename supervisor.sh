#!/bin/bash
# Bot supervisor - node ölürse 2 sn içinde yeniden başlat
cd /root/discord_mod_bot
while true; do
    if ! pgrep -f "node index.js" > /dev/null; then
        node index.js >> bot.log 2>&1
    else
        sleep 5
    fi
done