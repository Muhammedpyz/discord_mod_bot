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
        console.log(`Global komutlar siliniyor...`);
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] },
        );
        console.log(`Global komutlar silindi.`);

        console.log(`Sunucuya ${commands.length} komut yükleniyor...`);
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, '1062369725067304990'),
            { body: commands },
        );
        console.log(`${data.length} komut başarıyla sunucuya yüklendi.`);
    } catch (error) {
        console.error(error);
    }
})();
