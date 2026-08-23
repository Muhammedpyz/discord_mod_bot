const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const config = require('./config.json');

const commands = [];
const commandMap = new Map();
const foldersPath = path.join(__dirname, 'commands');

if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        if (!fs.statSync(commandsPath).isDirectory()) continue;
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.resolve(commandsPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                if (command && 'data' in command && 'execute' in command) {
                    const json = command.data.toJSON();
                    commandMap.set(json.name, json);
                }
            } catch (err) {
                console.error(`Komut okuma hatası (${file}):`, err.message);
            }
        }
    }
}

for (const cmd of commandMap.values()) {
    commands.push(cmd);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`[1/3] Toplam ${commands.length} adet geçerli komut toplandı.`);

        // 1. Tüm sunucu (Guild) komutlarını tamamen sil / temizle
        for (const guildId of config.ALLOWED_GUILDS) {
            console.log(`[2/3] Guild ${guildId} üzerindeki tüm sunucu tabanlı komutlar siliniyor...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: [] }
            );
            console.log(`✓ Guild ${guildId} komutları tamamen temizlendi.`);
        }

        // 2. Komutları SADECE GLOBAL olarak deploy et
        console.log(`[3/3] Komutlar SADECE GLOBAL olarak yükleniyor (${commands.length} komut)...`);
        const globalRes = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`✓ Başarıyla ${globalRes.length} komut GLOBAL olarak yüklendi!`);
        console.log('✓ SUNUCU TABANLI KOMUTLAR SİLİNDİ, SADECE GLOBAL KOMUTLAR AKTİF.');
    } catch (error) {
        console.error('Global deploy hatası:', error);
    }
})();
