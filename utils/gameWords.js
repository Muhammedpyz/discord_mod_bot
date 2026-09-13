// Oyunlar için gömülü Türkçe kelime listesi (harici API yok)
const WORDS = ['kitap','bulut','deniz','kalem','ağaç','çiçek','kelebek','bilgisayar','telefon','pencere','yıldız','güneş','orman','nehir','dağ','tren','uçak','gemi','kedi','köpek','kuş','balık','elma','armut','kiraz','portakal','ekmek','peynir','zeytin','domates','biber','soğan','sarımsak','patates','havuç','marul','ıspanak','lahana','turp','mantık','cesaret','özgürlük','barış','sevgi','saygı','dostluk','mutluluk','hüzün','korku','umut','rüya','gerçek','hayal','zaman','ışık','sessizlik','bulmaca','hediye','misafir','piknik','kamp','çadır','ateş','göl','şelale','vadi','ova','plato','ada','koy','liman','fener','köprü','tünel','stadyum','tiyatro','sinema','müze','kütüphane','okul','hastane','eczane','fırın','market','pazar','çarşı','hamam','cami','kilise','saray','kale','sur','meydan','cadde','sokak','park','bahçe'];

function pickWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function scramble(w) {
    const a = [...w];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    const s = a.join('');
    return s === w ? scramble(w) : s;
}

module.exports = { pickWord, scramble, WORDS };
