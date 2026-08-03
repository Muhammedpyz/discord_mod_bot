const fs = require('fs');
const path = require('path');

const commandMap = {
    'ban': 'yasakla',
    'unban': 'yasak-kaldır',
    'kick': 'at',
    'mute': 'sustur',
    'unmute': 'susturma-kaldır',
    'sesmute': 'ses-sustur',
    'uyar': 'uyar', // warn.js already has 'uyar' probably, let's check.
    'uyarilar': 'uyarılar',
    'uyaritemizle': 'uyarı-temizle',
    'clear': 'temizle',
    'slowmode': 'yavaş-mod',
    'kilit': 'kilit', // lockdown.js is 'kilit'
    'snipe': 'snipe',
    'kara-liste': 'kara-liste',
    'ticket': 'destek',
    'yardim': 'yardım'
};

const commandsDir = path.join(__dirname, 'commands', 'moderation');
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    const full = path.join(commandsDir, file);
    let content = fs.readFileSync(full, 'utf8');
    
    // Warn.js uses setName('uyar') etc.
    // Replace .setName('...') with the new name
    content = content.replace(/\.setName\(['"]([^'"]+)['"]\)/g, (match, currentName) => {
        // If currentName is in our map or if it's the filename without .js
        const filenameKey = file.replace('.js', '');
        let newName = currentName;
        
        if (commandMap[currentName]) {
            newName = commandMap[currentName];
        } else if (commandMap[filenameKey]) {
            newName = commandMap[filenameKey];
        } else if (currentName === 'yardim') {
            newName = 'yardım';
        } else if (currentName === 'uyaritemizle') {
            newName = 'uyarı-temizle';
        }
        
        return `.setName('${newName}')`;
    });
    
    fs.writeFileSync(full, content, 'utf8');
}

console.log('Command names updated in files.');
