const fs = require('fs');
const filePath = '/root/discord_mod_bot/events/interactionCreate.js';
let content = fs.readFileSync(filePath, 'utf8');

const map = {
    "getCmd('ban')": "getCmd('yasakla')",
    "getCmd('unban')": "getCmd('yasak-kaldır')",
    "getCmd('kick')": "getCmd('at')",
    "getCmd('mute')": "getCmd('sustur')",
    "getCmd('unmute')": "getCmd('susturma-kaldır')",
    "getCmd('sesmute')": "getCmd('ses-sustur')",
    "getCmd('warn')": "getCmd('uyar')",
    "getCmd('warnings')": "getCmd('uyarılar')",
    "getCmd('resetwarns')": "getCmd('uyarı-temizle')",
    "getCmd('clear')": "getCmd('temizle')",
    "getCmd('lockdown')": "getCmd('kilit')",
    "getCmd('slowmode')": "getCmd('yavaş-mod')",
    "getCmd('ticket')": "getCmd('destek')"
};

for (const [key, val] of Object.entries(map)) {
    content = content.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), val);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('interactionCreate.js help menu updated');
