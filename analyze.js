const data = require('./turklion_data.json');

const oyuncuRole = data.roles.find(r => r.name.toLowerCase().includes('oyuncu'));
const banliRole = data.roles.find(r => r.name.toLowerCase().includes('ban') || r.name.toLowerCase().includes('karantina'));
const karantinaRole = data.roles.find(r => r.name.toLowerCase().includes('karantina'));
const muteRole = data.roles.find(r => r.name.toLowerCase().includes('mute') || r.name.toLowerCase().includes('sustur'));

console.log("Oyuncu Role:", oyuncuRole ? oyuncuRole.name : 'Yok');
console.log("Banli Role:", banliRole ? banliRole.name : 'Yok');
console.log("Karantina Role:", karantinaRole ? karantinaRole.name : 'Yok');
console.log("Mute Role:", muteRole ? muteRole.name : 'Yok');

console.log("\n--- KANAL İZİNLERİ ---");
data.channels.forEach(ch => {
    ch.overrides.forEach(ov => {
        const isOyuncu = oyuncuRole && ov.target.includes(oyuncuRole.name);
        const isBanli = banliRole && ov.target.includes(banliRole.name);
        const isKarantina = karantinaRole && ov.target.includes(karantinaRole.name);
        const isMute = muteRole && ov.target.includes(muteRole.name);
        
        if (isOyuncu || isBanli || isKarantina || isMute) {
            console.log(`Kanal: ${ch.name}`);
            console.log(`  Hedef: ${ov.target}`);
            if (ov.allow.length > 0) console.log(`  -> İzin Verilen: ${ov.allow.includes('ViewChannel') ? 'ViewChannel ' : ''}${ov.allow.includes('SendMessages') ? 'SendMessages ' : ''}${ov.allow.includes('Connect') ? 'Connect ' : ''}`);
            if (ov.deny.length > 0) console.log(`  -> Yasaklanan: ${ov.deny.includes('ViewChannel') ? 'ViewChannel ' : ''}${ov.deny.includes('SendMessages') ? 'SendMessages ' : ''}${ov.deny.includes('Connect') ? 'Connect ' : ''}`);
        }
    });
});
