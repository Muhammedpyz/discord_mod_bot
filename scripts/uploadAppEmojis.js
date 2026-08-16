const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

function sanitizeEmojiName(filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let clean = base.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (clean.length < 2) clean = clean + '_em';
    if (clean.length > 32) clean = clean.substring(0, 32);
    return clean;
}

client.once('ready', async () => {
    console.log(`[App Emojis] ${client.user.tag} olarak bağlanıldı. Bot App Emojileri yükleniyor...`);

    try {
        const app = await client.application.fetch();
        console.log(`[App Emojis] Uygulama adı: ${app.name} (ID: ${app.id})`);

        // Mevcut bot emojilerini çek
        const existingEmojis = await app.emojis.fetch();
        console.log(`[App Emojis] Mevcut yüklü Bot Emojisi sayısı: ${existingEmojis.size}`);

        const existingMap = new Map();
        existingEmojis.forEach(em => {
            existingMap.set(em.name.toLowerCase(), em.id);
        });

        const emojiDir = path.join(__dirname, '../assets/emojis');
        const files = fs.readdirSync(emojiDir);

        const results = {};
        let uploadedCount = 0;
        let reusedCount = 0;
        let failCount = 0;

        for (const file of files) {
            const filePath = path.join(emojiDir, file);
            const name = sanitizeEmojiName(file);

            if (existingMap.has(name)) {
                results[name] = existingMap.get(name);
                reusedCount++;
                continue;
            }

            try {
                // Upload to Application Emojis
                const created = await app.emojis.create({
                    attachment: filePath,
                    name: name
                });
                results[name] = created.id;
                existingMap.set(name, created.id);
                uploadedCount++;
                console.log(`[+] Yüklendi: :${name}: -> ID: ${created.id}`);
                // Rate limit koruması
                await new Promise(r => setTimeout(r, 1200));
            } catch (err) {
                console.error(`[-] Yüklenemedi (${file}):`, err.message);
                failCount++;
            }
        }

        // app_emojis.json dosyasına kaydet
        const outPath = path.join(__dirname, '../assets/app_emojis.json');
        fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

        console.log(`\n=== YÜKLEME TAMAMLANDI ===`);
        console.log(`Yeni Yüklenen: ${uploadedCount}`);
        console.log(`Zaten Var Olan: ${reusedCount}`);
        console.log(`Hatalı/Atlanan: ${failCount}`);
        console.log(`Toplam Kayıt Edilen: ${Object.keys(results).length}`);
        console.log(`Dosya: ${outPath}`);

    } catch (e) {
        console.error('Kritik Hata:', e);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.DISCORD_TOKEN);
