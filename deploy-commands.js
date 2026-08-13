const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'commands');

if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            }
        }
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n=============================================================`);
        console.log(`🌟 DİKKAT: Komutlar GLOBAL ağa yükleniyor!`);
        console.log(`Bu işlem, botun profiline 'Komutları Destekler' rozeti ekler.`);
        console.log(`(Global komutların tüm Discord'a yayılması 1 saati bulabilir)`);
        console.log(`=============================================================\n`);

        console.log(`Global ağa ${commands.length} komut yükleniyor...`);
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        
        console.log(`${data.length} komut başarıyla GLOBAL ağa yüklendi!`);
        console.log(`Rozetin gelmesi için Discord'u (CTRL+R) ile yenileyin.\n`);
        process.exit(0);
    } catch (error) {
        console.error('Komutlar yüklenirken hata oluştu:', error);
        process.exit(1);
    }
})();
