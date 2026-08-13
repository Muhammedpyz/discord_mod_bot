const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log('Bot hazir. Sunucular taranıyor...');
    
    for (const [guildId, guild] of client.guilds.cache) {
        console.log(`Temizleniyor: ${guild.name} (${guildId})`);
        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: [] }
            );
            console.log(`-> ${guild.name} icin komutlar temizlendi.`);
        } catch (e) {
            console.log(`Hata: ${e.message}`);
        }
    }
    console.log('Tüm sunuculardaki çift (guild) komutları silindi!');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
