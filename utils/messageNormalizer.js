// utils/messageNormalizer.js

/**
 * Mesajı küfür/kelime filtresini atlatmak (bypass) için kullanılan 
 * özel karakterlerden ve boşluklardan temizler.
 * Örneğin: "k.ü.f.ü.r" -> "kufur"
 */
function normalizeMessage(content) {
    if (!content) return '';
    
    // Türkçe karakterleri standartlaştırma
    const charMap = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    };
    
    let normalized = content;
    
    // Harf dönüştürme
    for (const [key, value] of Object.entries(charMap)) {
        const regex = new RegExp(key, 'g');
        normalized = normalized.replace(regex, value);
    }
    
    // Tüm noktalama işaretlerini, özel karakterleri ve boşlukları sil (sadece harf ve rakam kalsın)
    normalized = normalized.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return normalized;
}

module.exports = { normalizeMessage };
