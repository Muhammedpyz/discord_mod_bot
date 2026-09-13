const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'commands.log');

/**
 * Format date to YYYY-MM-DD HH:mm:ss
 */
function getTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const h = pad(now.getHours());
    const min = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Extract options from a CommandInteraction into a readable object
 */
function extractCommandOptions(interaction) {
    if (!interaction.options || !interaction.options.data) return {};
    const result = {};
    function parseOpts(options) {
        for (const opt of options) {
            if (opt.value !== undefined) {
                result[opt.name] = opt.value;
            } else if (opt.options) {
                result[opt.name] = {};
                parseOpts(opt.options);
            }
        }
    }
    parseOpts(interaction.options.data);
    return result;
}

/**
 * Analyze an error and return a detailed diagnosis explaining WHY it happened
 */
function diagnoseError(error) {
    if (!error) return 'Bilinmeyen Hata Durumu';
    
    const msg = error.message || String(error);
    const code = error.code || error.rawError?.code;

    // Discord API Error Codes
    if (code === 10062 || msg.includes('Unknown interaction')) {
        return 'ZAMAN AŞIMI (TIMEOUT): Discord 3 saniye yanıt kuralı aşıldı. Komut veya etkileşim ilk 3 saniyede deferReply()/deferUpdate() almadı veya sunucu/veritabanı gecikmesi yaşandı.';
    }
    if (code === 40060 || msg.includes('already been acknowledged') || msg.includes('InteractionAlreadyReplied')) {
        return 'ÇİFT YANITLAMA: Etkileşim zaten deferReply() veya reply() ile yanıtlanmışken tekrar reply() çağrıldı. (editReply veya followUp kullanılmalı).';
    }
    if (code === 50035 || msg.includes('Invalid Form Body')) {
        return 'GEÇERSİZ FORM / MODAL YAPISI: ModalBuilder içerisine yalnızca TextInput (type 4) konulabilir. SelectMenu veya geçersiz buton yerleştirilmiş olabilir veya karakter limiti aşılmıştır.';
    }
    if (code === 50013 || code === 50001 || msg.includes('Missing Permissions') || msg.includes('Missing Access')) {
        return 'YETKİ EKSİKLİĞİ: Botun bu işlemi (Rol verme, ban, susturma, kanal yönetimi vb.) yapabilmek için Discord sunucu yetkisi veya rol hiyerarşisi yetersiz.';
    }
    if (msg.includes('InteractionNotReplied')) {
        return 'DEFER EKSİK: Etkileşim yanıtlanmadan veya defer edilmeden editReply() çağrılmaya çalışıldı.';
    }

    // Database / MariaDB Errors
    if (code === 'ER_GET_CONNECTION_TIMEOUT' || msg.includes('pool failed to retrieve a connection')) {
        return 'VERİTABANI HAVUZ KİLİTLENMESİ: MariaDB bağlantı havuzu (connection pool) tükendi veya sorgular kilitlendi. Bağlantı serbest bırakılmamış (release) veya aşırı CREATE TABLE sorgusu yapılmış olabilir.';
    }
    if (code === 'ECONNREFUSED') {
        return 'VERİTABANI KAPALI: MariaDB (MySQL) servisi çalışmıyor veya 3306 portu erişilemez durumda.';
    }
    if (code === 'ER_NO_SUCH_TABLE' || msg.includes("doesn't exist")) {
        return 'EKSİK TABLO: İlgili SQL tablosu veritabanında mevcut değil.';
    }
    if (code === 'ER_DUP_ENTRY' || msg.includes('Duplicate entry')) {
        return 'TEKRARLAYAN KAYIT: Veritabanında benzersiz (UNIQUE/PRIMARY) olması gereken bir alan zaten mevcut.';
    }

    // Generic JS Errors
    if (error instanceof TypeError) {
        return `TİP HATASI (TypeError): Tanımsız nesne üzerinden işlem yapıldı (Örn: null/undefined okunmaya çalışıldı) -> ${msg}`;
    }
    if (error instanceof ReferenceError) {
        return `TANIMSIZ DEĞİŞKEN (ReferenceError): Kod içinde tanımlanmamış bir değişken çağrıldı -> ${msg}`;
    }

    return `SİSTEMSEL HATA: ${msg}`;
}

/**
 * Log a command or interaction execution (Success or Failure) to commands.log
 */
function logCommandExecution({
    interaction,
    commandName,
    durationMs = 0,
    success = true,
    error = null,
    extraInfo = null,
    source = 'SLASH' // 'SLASH', 'PREFIX', 'BUTTON', 'SELECT_MENU', 'MODAL'
}) {
    try {
        const time = getTimestamp();
        
        let user = 'Bilinmeyen Kullanıcı';
        let guild = 'DM / Bilinmiyor';
        let channel = 'Bilinmiyor';

        if (interaction) {
            const u = interaction.user || interaction.author;
            if (u) user = `${u.tag || u.username} (${u.id})`;
            
            const g = interaction.guild;
            if (g) guild = `${g.name} (${g.id})`;
            else if (interaction.guildId) guild = interaction.guildId;

            const ch = interaction.channel;
            if (ch) channel = `#${ch.name || 'kanal'} (${ch.id || interaction.channelId})`;
            else if (interaction.channelId) channel = interaction.channelId;
        }

        let paramsStr = 'Yok';
        if (interaction?.isChatInputCommand && interaction.isChatInputCommand()) {
            const opts = extractCommandOptions(interaction);
            paramsStr = Object.keys(opts).length > 0 ? JSON.stringify(opts) : 'Yok';
        } else if (interaction?.customId) {
            paramsStr = `customId: "${interaction.customId}"`;
            if (interaction.values && Array.isArray(interaction.values)) {
                paramsStr += ` | values: [${interaction.values.join(', ')}]`;
            }
        } else if (extraInfo?.args) {
            paramsStr = `args: [${extraInfo.args.join(' ')}]`;
        }

        let logEntry = '';
        if (success) {
            logEntry = `[${time}] [BAŞARILI] [${source}] Komut/Etkileşim: ${commandName} | Süre: ${durationMs}ms | Kullanıcı: ${user} | Sunucu: ${guild} | Kanal: ${channel} | Giriş: ${paramsStr}\n`;
        } else {
            const errorReason = error?.message || String(error || 'Bilinmeyen hata');
            const diagnosis = diagnoseError(error);
            const errorStack = error?.stack ? error.stack.split('\n').slice(1).map(l => '    ' + l.trim()).join('\n') : '    Stack trace bulunamadı';
            
            logEntry = `\n==================== [KOMUT / ETKİLEŞİM HATASI RAPORU] ====================\n` +
                `Tarih: ${time}\n` +
                `Tetikleyici Türü: [${source}]\n` +
                `Komut / Etkileşim: ${commandName}\n` +
                `İşlem Süresi: ${durationMs}ms\n` +
                `Kullanıcı: ${user}\n` +
                `Sunucu: ${guild}\n` +
                `Kanal: ${channel}\n` +
                `Giriş / Parametreler: ${paramsStr}\n` +
                `HATA NEDENİ (Mesaj): ${errorReason}\n` +
                `TEŞHİS & ÇÖZÜM AÇIKLAMASI: ${diagnosis}\n` +
                (error?.code ? `HATA KODU: ${error.code}\n` : '') +
                (error?.status ? `HTTP STATÜ: ${error.status}\n` : '') +
                (extraInfo ? `EKSTRA BİLGİ: ${JSON.stringify(extraInfo, null, 2)}\n` : '') +
                `STACK TRACE:\n${errorStack}\n` +
                `============================================================================\n\n`;
        }

        fs.appendFile(LOG_FILE, logEntry, 'utf8', (err) => {
            if (err) console.error('[CommandLogger] Log dosyasına yazılamadı:', err.message);
        });
    } catch (loggingErr) {
        console.error('[CommandLogger] Loglama esnasında hata:', loggingErr);
    }
}

module.exports = {
    logCommandExecution,
    diagnoseError,
    LOG_FILE
};
