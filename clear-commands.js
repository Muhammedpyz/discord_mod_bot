const { REST, Routes } = require('discord.js');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Eski global komutlar siliniyor...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
        console.log('Global komutlar silindi.');

        // Eğer guild komutları varsa, tek bir guild ID vererek onları da silebiliriz ama genellikle global silmek yeterlidir.
        // Deploy işlemini baştan yapalım.
        require('./deploy-commands.js');
    } catch (error) {
        console.error(error);
    }
})();
