const fs = require('fs');
const path = require('path');

let GITHUB_SWEAR_WORDS = [];
try {
    const dataPath = path.join(__dirname, '../data_kufurler.json');
    if (fs.existsSync(dataPath)) {
        GITHUB_SWEAR_WORDS = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
} catch (e) {
    console.error("Küfür listesi yükleme hatası:", e);
}

const BUILTIN_SWEAR_WORDS = Array.from(new Set([
    'amk', 'aq', 'amq', 'oç', 'oc', 'orospu', 'oruspu', 'piç', 'pic', 'sik', 'sikik', 'siktir',
    'yarrak', 'yarak', 'yavşak', 'yavsak', 'göt', 'got', 'amcık', 'amcik', 'pezevenk', 'kahpe',
    'ibne', 'puşt', 'pust', 'taşak', 'tasak', 'döl', 'dol', 'meme', 'memeucu', 'sikiş', 'sikis',
    'amına', 'amina', 'koyayım', 'koyayim', 'ananı', 'anani', 'bacını', 'bacini', 'ebeni',
    'orospu çocuğu', 'orospu cocugu', 'ananın amı', 'ananin ami', 'götveren', 'gotveren',
    'kahpenin evladı', 'kahpe evladi', 'amk çocuğu', 'sürtük', 'surtuk',
    ...GITHUB_SWEAR_WORDS
]));

function checkBuiltinSwear(content) {
    if (!content) return null;
    const lower = content.toLowerCase()
        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
        .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u');

    const cleanWordString = lower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleanWordString.split(' ');

    for (const swear of BUILTIN_SWEAR_WORDS) {
        const normSwear = swear.toLowerCase()
            .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u').trim();

        if (!normSwear) continue;

        if (normSwear.includes(' ')) {
            if (cleanWordString.includes(normSwear)) return swear;
        } else if (normSwear.length <= 4) {
            if (words.includes(normSwear)) return swear;
        } else {
            if (words.includes(normSwear) || words.some(w => w.startsWith(normSwear) || w.includes(normSwear))) {
                return swear;
            }
        }
    }
    return null;
}

module.exports = { BUILTIN_SWEAR_WORDS, checkBuiltinSwear };
