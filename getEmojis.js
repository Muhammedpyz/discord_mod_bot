require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers] });

client.once('ready', async () => {
    console.log('Logged in as ' + client.user.tag);
    let output = "Found Emojis:\n";
    let count = 0;
    
    // Explicitly fetch guilds and their emojis
    for (const guild of client.guilds.cache.values()) {
        try {
            const emojis = await guild.emojis.fetch();
            emojis.forEach(emoji => {
                output += `Name: ${emoji.name} | ID: ${emoji.id}\n`;
                count++;
            });
        } catch(e) {
            console.error(`Failed to fetch emojis for guild ${guild.id}`);
        }
    }
    
    console.log(`Total emojis fetched: ${count}`);
    const fs = require('fs');
    fs.writeFileSync('emojis.txt', output);
    process.exit(0);
});

client.login(process.env.TOKEN).catch(console.error);
