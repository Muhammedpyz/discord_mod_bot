require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers] });

client.once('ready', () => {
    console.log('Logged in as ' + client.user.tag);
    let output = "Found Emojis:\n";
    client.emojis.cache.forEach(emoji => {
        output += `Name: ${emoji.name} | ID: ${emoji.id}\n`;
    });
    console.log(output);
    process.exit(0);
});

client.login(process.env.TOKEN).catch(console.error);
