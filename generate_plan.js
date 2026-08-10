const fs = require('fs');
const data = require('./turklion_data.json');

let md = `# TurkLion Network - Kapsamlı Rol ve Kanal İzin Planı (Öneri Raporu)\n\n`;
md += `Bu rapor, sunucudaki tüm rollerin ve tüm kanalların siber güvenlik ve sunucu düzeni açısından **olması gereken** detaylı izin şemasını barındırır. Diğer yapay zeka asistanlarına danışabilmeniz için özel olarak hazırlanmıştır.\n\n`;

md += `## 1. ROLLER VE KÜRESEL (SUNUCU) İZİNLERİ\n\n`;
md += `Aşağıdaki liste sunucudaki tüm rolleri ve onların "Sunucu Ayarları -> Roller" kısmında sahip olması gereken ana yetkilerini listeler:\n\n`;

const adminRoles = ['Yönetici', 'Geliştirici', 'GOD', 'The Türklions.'];
const staffRoles = ['Discord Moderatör', 'Moderatör', 'Asistan', 'Yardımcı', 'Medya Sorumlusu', 'Ekosistem'];
const vipRoles = ['VIP', 'VIP+', 'SVIP', 'MVIP', 'LVIP', 'LVIP+', 'ULTRA'];
const punishRoles = ['Ban', 'Uyarı', 'Uyarı 2', 'Mute'];
const normalRoles = ['Oyuncu', '@everyone', 'Server Booster'];

data.roles.forEach(role => {
    let permDesc = '';
    if (adminRoles.includes(role.name)) {
        permDesc = `**SADECE Administrator (Yönetici)** yetkisi açık olmalı. (Geri kalan hiçbir şeye gerek yok).`;
    } else if (staffRoles.includes(role.name)) {
        permDesc = `**Kesinlikle Yönetici KAPALI.** Sadece: Üyeleri At, Üyeleri Sustur, Mesajları Yönet, Kanalları Yönet (sınırlı).`;
    } else if (vipRoles.includes(role.name)) {
        permDesc = `Standart yetkilere ek olarak: Harici Emojiler Kullan, Harici Çıkartmalar Kullan, Gömülü Bağlantılar. Kesinlikle Moderasyon yetkisi yok.`;
    } else if (punishRoles.includes(role.name) || role.name.toLowerCase().includes('ban') || role.name.toLowerCase().includes('mute')) {
        permDesc = `**HİÇBİR YETKİ YOK.** Bütün yetki kutucukları boş (kapalı) olmalı.`;
    } else {
        permDesc = `Sadece: Kanalları Görüntüle, Mesaj Gönder, Sese Bağlan, Konuş, Tepki Ekle. (Everyone/Here Etiketleme KAPALI).`;
    }
    md += `- **Role Adı:** \`${role.name}\`\n  - **Önerilen Ana İzinler:** ${permDesc}\n\n`;
});

md += `\n## 2. KANALLAR VE KANAL BAZLI ÖZEL İZİNLER (OVERWRITES)\n\n`;
md += `Aşağıda sunucudaki HER BİR KANAL ve o kanalda hangi rolün hangi izne sahip olması gerektiği (Allow/Deny) detaylıca listelenmiştir:\n\n`;

data.channels.forEach(ch => {
    md += `### Kanal: \`${ch.name}\` (Tipi: ${ch.type === 4 ? 'Kategori' : (ch.type === 2 ? 'Ses Kanalı' : 'Metin Kanalı')})\n`;
    
    let allowEveryone = false;
    let allowVip = false;
    let allowStaff = false;
    let readOnly = false;
    
    const name = ch.name.toLowerCase();
    
    // Kategorizasyon
    if (name.includes('vip') || name.includes('youtuber')) {
        allowVip = true;
    } else if (name.includes('yetkili') || name.includes('yönetim') || name.includes('mod') || name.includes('log') || name.includes('personel') || name.includes('geliştirme') || name.includes('plan') || name.includes('toplantı') || name.includes('hatalar') || name.includes('mimar-sohbet') || name.includes('Oda Olustur')) {
        allowStaff = true;
    } else if (name.includes('kurallar') || name.includes('duyuru') || name.includes('giriş') || name.includes('bilgi')) {
        allowEveryone = true;
        readOnly = true;
    } else {
        allowEveryone = true;
    }
    
    md += `**Bu Kanalda Olması Gereken İzin Ayarları:**\n`;
    
    if (allowStaff) {
        md += `- **@everyone & Oyuncu & VIP'ler:** \`Görüntüleme: KAPALI (Deny)\`\n`;
        md += `- **Moderatör / Asistan / Yardımcı:** \`Görüntüleme: AÇIK (Allow)\`, \`Mesaj Gönder: AÇIK (Allow)\`\n`;
        md += `- **Ban / Ceza Rolleri:** \`Görüntüleme: KAPALI (Deny)\`\n`;
    } else if (allowVip) {
        md += `- **@everyone & Oyuncu:** \`Görüntüleme: KAPALI (Deny)\`\n`;
        md += `- **VIP Rolleri (Tümü):** \`Görüntüleme: AÇIK (Allow)\`, \`Mesaj Gönder: AÇIK (Allow)\`\n`;
        md += `- **Ban / Ceza Rolleri:** \`Görüntüleme: KAPALI (Deny)\`\n`;
    } else if (allowEveryone) {
        if (readOnly) {
            md += `- **@everyone & Oyuncu:** \`Görüntüleme: AÇIK (Allow)\`, \`Mesaj Gönder: KAPALI (Deny)\`\n`;
        } else {
            md += `- **@everyone & Oyuncu:** \`Görüntüleme: AÇIK (Allow)\`, \`Mesaj Gönder: AÇIK (Allow)\`\n`;
        }
        md += `- **VIP Rolleri:** (Oyuncu iznini miras alacakları için özel ayara gerek yok)\n`;
        md += `- **Ban / Ceza Rolleri:** \`Görüntüleme: KAPALI (Deny)\`, \`Mesaj Gönder: KAPALI (Deny)\`\n`;
    }
    
    md += `\n`;
});

md += `\n---\n**Not:** "Üst Yönetim (Yönetici, GOD, Geliştirici)" rollerinde 'Yönetici (Administrator)' yetkisi açık olduğu için hiçbir kanalda onlara özel Allow/Deny ayarı yapılmasına gerek yoktur, her yeri otomatik görürler.\n`;
md += `**Rol Hafızası Notu:** Banned (Karantina) veya Mute yiyen kullanıcıların diğer tüm rolleri (Oyuncu, VIP vb.) geçici olarak ellerinden alınmalıdır ki, o rollerin yeşil tikleri Ceza rollerinin kırmızı çarpısını ezmesin.\n`;

fs.writeFileSync('TurkLion_Detailed_Permission_Plan.md', md);
console.log("Plan created.");
