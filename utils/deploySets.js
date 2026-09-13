// Discord limiti: guild başına max 100, global max 100 komut.
// Strateji: GUILD (anında aktif, operasyonel çekirdek) + GLOBAL ( ~1 saatte yayılır, eğlence/müzik/bilgi).
// İsim çakışması YOK: bir komut ya guild'de ya globalde.
const fs = require('fs');
const path = require('path');

const BASE = '/home/muhammedpyz/Desktop/discord_mod_bot';

// Global'e giden komut isimleri (geri kalan her şey guild'e gider, max 100 kontrolüyle)
const GLOBAL_NAMES = new Set([
    // fun (25)
    '8ball', 'zar', 'yazi-tura', 'ask-olcer', 'espri', 'gif', 'xox', 'sayı-tahmin',
    'kelime-oyunu', 'adam-asmaca', 'düello', 'zar-düello', 'taş-kağıt-makas', 'hızlı-yaz',
    'bilgi-yarışması', 'bunu-mu', 'basar-mıydın', 'sataş', 'hack', 'ilginç-bilgi',
    'dünya-saati', 'ters-çevir', 'efekt', 'kedi', 'köpek',
    // economy-fun (12)
    'çalış', 'suç-işle', 'slots', 'blackjack', 'balık-tut', 'dilen', 'saatlik',
    'hediye', 'para-ver', 'para-al', 'rulet', 'crash',
    // music (18)
    '247', 'autoplay', 'filter', 'music-history', 'like', 'loop', 'lyrics', 'nowplaying',
    'pause', 'play', 'playlist', 'queue', 'resume', 'seek', 'shuffle', 'skip', 'stop', 'volume',
    // müzik-dışı overflow (dinleme/izleme anlık olmak zorunda değil)
    'spotify',
    // bilgi + araçlar (16)
    'hava-durumu', 'çeviri', 'kripto', 'döviz', 'kısalt', 'wikipedia', 'github', 'npm', 'qr',
    'hesapla', 'şifre-üret', 'emoji-büyüt', 'mc-sunucu', 'mc', 'roblox', 'steam',
    // utility overflow (2)
    'yapiskan', 'rol-bilgi'
]);

function loadAll() {
    const all = [];
    const foldersPath = path.join(BASE, 'commands');
    for (const folder of fs.readdirSync(foldersPath)) {
        const p = path.join(foldersPath, folder);
        if (!fs.statSync(p).isDirectory()) continue;
        for (const file of fs.readdirSync(p).filter(f => f.endsWith('.js'))) {
            try {
                const loaded = require(path.join(p, file));
                const list = Array.isArray(loaded) ? loaded : [loaded];
                for (const c of list) {
                    if (c.data && c.execute) all.push(c);
                }
            } catch (e) {
                console.log('YÜKLEME HATASI:', folder + '/' + file, e.message);
            }
        }
    }
    return all;
}

function buildSets() {
    const all = loadAll();
    const guildList = [];
    const globalList = [];
    for (const c of all) {
        (GLOBAL_NAMES.has(c.data.name) ? globalList : guildList).push(c);
    }
    // Kayıp isim kontrolü: GLOBAL_NAMES'ta olup bulunamayan varsa uyar
    const found = new Set(all.map(c => c.data.name));
    for (const n of GLOBAL_NAMES) {
        if (!found.has(n)) console.log('UYARI: global listede ama bulunamadı:', n);
    }
    if (guildList.length > 100) throw new Error(`Guild seti limiti aşıyor: ${guildList.length}/100`);
    if (globalList.length > 100) throw new Error(`Global seti limiti aşıyor: ${globalList.length}/100`);
    return { guild: guildList, global: globalList, total: all.length };
}

module.exports = { buildSets, GLOBAL_NAMES };
