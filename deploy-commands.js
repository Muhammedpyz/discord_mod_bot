const { REST, Routes } = require('discord.js');
require('dotenv').config();
const { buildSets } = require('./utils/deploySets');

// Global set (max 100): eğlence + müzik + bilgi. Guild setiyle çakışma yok.
const { global } = buildSets();
const commands = global.map(c => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n=============================================================`);
        console.log(`Global aga ${commands.length} komut yukleniyor (profil rozeti icin)...`);
        console.log(`(Yayilmasi 1 saati bulabilir)`);
        console.log(`=============================================================\n`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`${data.length} komut GLOBAL aga yuklendi!`);
        process.exit(0);
    } catch (error) {
        console.error('Komutlar yüklenirken hata oluştu:', error);
        process.exit(1);
    }
})();
