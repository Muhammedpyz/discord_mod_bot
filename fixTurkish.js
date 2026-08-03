const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const replacements = {
        'kullanici': 'kullanıcı',
        'Kullanici': 'Kullanıcı',
        'basariyla': 'başarıyla',
        'Basariyla': 'Başarıyla',
        'yasagi': 'yasağı',
        'Yasagi': 'Yasağı',
        'kaldir': 'kaldır',
        'Kaldir': 'Kaldır',
        'uyari': 'uyarı',
        'Uyari': 'Uyarı',
        'islem': 'işlem',
        'Islem': 'İşlem',
        'olustu': 'oluştu',
        'Olustu': 'Oluştu',
        'gecmisi': 'geçmişi',
        'Gecmisi': 'Geçmişi',
        'gosterir': 'gösterir',
        'Gosterir': 'Gösterir',
        'sifirlar': 'sıfırlar',
        'Sifirlar': 'Sıfırlar',
        'veritabani': 'veritabanı',
        'Veritabani': 'Veritabanı',
        'YETKILI': 'YETKİLİ',
        'yetkili': 'yetkili',
        'Yetkili': 'Yetkili',
        'BILGILENDIRME': 'BİLGİLENDİRME',
        'gonderilemedi': 'gönderilemedi',
        'ayarlanmadigi': 'ayarlanmadığı',
        'Uyarildi': 'Uyarıldı',
        'uyarildi': 'uyarıldı',
        'uyarir': 'uyarır',
        'Uyarilacak': 'Uyarılacak',
        'uyarilacak': 'uyarılacak',
        'pasiflesecek': 'pasifleşecek',
        'aktiflesecek': 'aktifleşecek',
        'gun': 'gün',
        'Gun': 'Gün',
        'Uyarilan': 'Uyarılan',
        'Uye': 'Üye',
        'uye': 'üye',
        'Sayisi': 'Sayısı',
        'Orn': 'Örn',
        'susturur': 'susturur',
        'susturma': 'susturma',
        'Gecerli': 'Geçerli',
        'gecerli': 'geçerli',
        'hiyerarsisini': 'hiyerarşisini',
        'asimi': 'aşımı',
        'uygulanamadi': 'uygulanamadı',
        'Susturuldu': 'Susturuldu',
        'Susturmasi': 'Susturması',
        'sureyle': 'süreyle',
        'uygulandi': 'uygulandı',
        'Ayrica': 'Ayrıca',
        'tarafindan': 'tarafından',
        'eklendi': 'eklendi',
        'Yasaklanacak': 'Yasaklanacak',
        'yasaklanacak': 'yasaklanacak',
        'yasaklandiniz': 'yasaklandınız',
        'haksiz': 'haksız',
        'dusunuyorsaniz': 'düşünüyorsanız',
        'asagidaki': 'aşağıdaki',
        'tiklayarak': 'tıklayarak',
        'itiraz': 'itiraz',
        'atilabilmesi': 'atılabilmesi',
        'olmasi': 'olması',
        'Yasaklandi': 'Yasaklandı',
        'yasakli': 'yasaklı',
        'rolu': 'rolü',
        'Rolü': 'Rolü',
        'verildi': 'verildi',
        'diger': 'diğer',
        'rolleri': 'rolleri',
        'alindi': 'alındı',
        'sirasinda': 'sırasında',
        'cikarildi': 'çıkarıldı',
        'gonderim': 'gönderim',
        'ayarlanmistir': 'ayarlanmıştır',
        'Uyelerimiz': 'Üyelerimiz',
        'atabilecektir': 'atabilecektir',
        'yavas': 'yavaş',
        'Yavas': 'Yavaş',
        'degistirilirken': 'değiştirilirken',
        'erisimi': 'erişimi',
        'Asagida': 'Aşağıda',
        'alinirken': 'alınırken'
    };

    let original = content;
    for (const [key, val] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        content = content.replace(regex, val);
    }

    content = content.replace(/\bkullanici(yi|nin|ya)\b/g, (match, p1) => {
        if (p1 === 'yi') return 'kullanıcıyı';
        if (p1 === 'nin') return 'kullanıcının';
        if (p1 === 'ya') return 'kullanıcıya';
        return match;
    });

    content = content.replace(/\bKullanici(yi|nin|ya|si)\b/g, (match, p1) => {
        if (p1 === 'yi') return 'Kullanıcıyı';
        if (p1 === 'nin') return 'Kullanıcının';
        if (p1 === 'ya') return 'Kullanıcıya';
        if (p1 === 'si') return 'Kullanıcısı';
        return match;
    });
    
    content = content.replace(/\b(U|u)yarilari\b/g, '$1yarıları');
    content = content.replace(/\b(U|u)yarilarini\b/g, '$1yarılarını');
    content = content.replace(/\b(S|s)ifirlanacak\b/g, '$1ıfırlanacak');
    content = content.replace(/\b(S|s)ifirlandi\b/g, '$1ıfırlandı');
    content = content.replace(/\b(S|s)ifirlanmistir\b/g, '$1ıfırlanmıştır');
    content = content.replace(/\b(S|s)ifirlanirken\b/g, '$1ıfırlanırken');
    content = content.replace(/\b(O|o)lusturulurken\b/g, '$1luşturulurken');
    content = content.replace(/\b(O|o)lusturuldu\b/g, '$1luşturuldu');
    content = content.replace(/\b(K|k)aldirilmistir\b/g, '$1aldırılmıştır');
    content = content.replace(/\b(K|k)aldirildi\b/g, '$1aldırıldı');
    content = content.replace(/\b(Y|y)onetim\b/g, '$1önetim');
    content = content.replace(/\b(Y|y)onetici\b/g, '$1önetici');
    content = content.replace(/\bhakkinda\b/g, 'hakkında');
    content = content.replace(/\b(M|m)enusu\b/g, '$1enüsü');
    content = content.replace(/\b(A|a)cilip\b/g, '$1çılıp');
    content = content.replace(/\b(A|a)cilmis\b/g, '$1çılmış');
    content = content.replace(/\bbasariyla\b/g, 'başarıyla');
    content = content.replace(/\bBasariyla\b/g, 'Başarıyla');

    if (original !== content) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', filePath);
    }
}

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walk(full);
        } else if (file.endsWith('.js')) {
            replaceInFile(full);
        }
    }
}

walk(path.join(__dirname, 'commands'));
walk(path.join(__dirname, 'utils'));
walk(path.join(__dirname, 'events'));

console.log('Done replacing!');
function replaceInFileMore(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const replacements = {
        'verilmistir': 'verilmiştir',
        'icin': 'için',
        'islemi': 'işlemi',
        'Islemleri': 'İşlemleri',
        'Islemi': 'İşlemi',
        'tamamlanamamistir': 'tamamlanamamıştır',
        'Lutfen': 'Lütfen',
        'ayarlari': 'ayarları',
        'Eger': 'Eğer',
        'yasagin': 'yasağın',
        'oldugunu': 'olduğunu',
        'kaldirilmis': 'kaldırılmış',
        'kullanicisinin': 'kullanıcısının',
        'uyarisi': 'uyarısı',
        'bulunmamaktadir': 'bulunmamaktadır',
        'uzerinden': 'üzerinden',
        'olusturma': 'oluşturma',
        'yonetme': 'yönetme',
        'islevleri': 'işlevleri',
        'saglar': 'sağlar',
        'yasagini': 'yasağını',
        'kaldirilacak': 'kaldırılacak',
        'susturmasini': 'susturmasını',
        'Sifirlama': 'Sıfırlama',
        'adli': 'adlı',
        'Uyarilar': 'Uyarılar',
        'hatasi': 'hatası',
        'su anda': 'şu anda',
        'kanalinda': 'kanalında',
        'degil': 'değil',
        'kullanicilara': 'kullanıcılara',
        'isleme': 'işleme',
        'Olusturma': 'Oluşturma',
        'Katilim': 'Katılım',
        'yonetici': 'yönetici',
        'Yonetici': 'Yönetici',
        'ozel': 'özel',
        'Ozel': 'Özel',
        'gonderilemedi': 'gönderilemedi',
        'yalnizca': 'yalnızca',
        'cikarildi': 'çıkarıldı',
        'degistirilirken': 'değiştirilirken',
        'basariyla': 'başarıyla',
        'yapilandirmasinda': 'yapılandırmasında',
        'bulunamadi': 'bulunamadı',
        'uzerinde': 'üzerinde',
        'olusturuldu': 'oluşturuldu',
        'Goster': 'Göster',
        'goster': 'göster',
        'Cikarildi': 'Çıkarıldı',
        'Yapildi': 'Yapıldı',
        'yapildi': 'yapıldı'
    };

    let original = content;
    for (const [key, val] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        content = content.replace(regex, val);
    }

    if (original !== content) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed More:', filePath);
    }
}

function walkMore(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walkMore(full);
        } else if (file.endsWith('.js')) {
            replaceInFileMore(full);
        }
    }
}

walkMore(path.join(__dirname, 'commands'));
walkMore(path.join(__dirname, 'utils'));
walkMore(path.join(__dirname, 'events'));
