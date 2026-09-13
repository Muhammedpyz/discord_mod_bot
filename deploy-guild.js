const { REST, Routes } = require('discord.js');
require('dotenv').config();
const { buildSets } = require('./utils/deploySets');

const { guild } = buildSets();
const commands = guild.map(c => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        for (const guildId of require('./config.json').ALLOWED_GUILDS) {
            try {
                const data = await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                    { body: commands },
                );
                console.log(`Guild ${guildId}: ${data.length} komut kuruldu.`);
            } catch (e) {
                console.log(`Guild ${guildId} HATA:`, e.code || e.message);
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Komutlar yüklenirken hata oluştu:', error);
        process.exit(1);
    }
})();
