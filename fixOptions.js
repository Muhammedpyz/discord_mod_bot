const fs = require('fs');
const path = require('path');

const fixes = {
    'ban.js': {
        builderNames: ['yasakla', 'kullanıcı', 'sebep', 'gün'],
        optionGets: {
            "getUser('user')": "getUser('kullanıcı')",
            "getString('reason')": "getString('sebep')",
            "getInteger('days')": "getInteger('gün')"
        }
    },
    'kick.js': {
        builderNames: ['at', 'kullanıcı', 'sebep'],
        optionGets: {
            "getUser('user')": "getUser('kullanıcı')",
            "getString('reason')": "getString('sebep')"
        }
    },
    'mute.js': {
        builderNames: ['sustur', 'kullanıcı', 'süre', 'sebep'],
        optionGets: {
            "getUser('user')": "getUser('kullanıcı')",
            "getString('duration')": "getString('süre')",
            "getString('reason')": "getString('sebep')"
        }
    },
    'unban.js': {
        builderNames: ['yasak-kaldır', 'kullanıcı'],
        optionGets: {
            "getUser('user')": "getUser('kullanıcı')"
        }
    },
    'unmute.js': {
        builderNames: ['susturma-kaldır', 'kullanıcı'],
        optionGets: {
            "getUser('user')": "getUser('kullanıcı')"
        }
    },
    'sesmute.js': {
        builderNames: ['ses-sustur', 'kullanıcı', 'süre'],
        optionGets: {
            "getUser('user')": "getUser('kullanıcı')",
            "getInteger('duration')": "getInteger('süre')" // wait, in sesmute it was getInteger for duration
        }
    },
    'clear.js': {
        builderNames: ['temizle', 'miktar'],
        optionGets: {
            "getInteger('amount')": "getInteger('miktar')"
        }
    },
    'slowmode.js': {
        builderNames: ['yavaş-mod', 'saniye'],
        optionGets: {
            "getInteger('seconds')": "getInteger('saniye')"
        }
    },
    'ticket.js': {
        builderNames: ['destek', 'aç', 'kategori', 'sebep', 'kapat', 'panel'],
        optionGets: {
            "getSubcommand() === 'ac'": "getSubcommand() === 'aç'",
            "getString('kategori')": "getString('kategori')",
            "getString('sebep')": "getString('sebep')"
        }
    }
};

for (const [file, fix] of Object.entries(fixes)) {
    const filePath = path.join(__dirname, 'commands', 'moderation', file);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // First, fix builder names: replace every .setName('...') with the corresponding one in the array
    let i = 0;
    content = content.replace(/\.setName\(['"]([^'"]+)['"]\)/g, (match, p1) => {
        const newName = fix.builderNames[i] || fix.builderNames[fix.builderNames.length - 1]; // fallback just in case
        i++;
        return `.setName('${newName}')`;
    });
    
    // Then replace option calls in execute()
    if (fix.optionGets) {
        for (const [oldGet, newGet] of Object.entries(fix.optionGets)) {
            content = content.replace(oldGet, newGet);
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', file);
}
