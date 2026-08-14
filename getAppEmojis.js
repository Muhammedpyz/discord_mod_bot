require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log('Logged in as ' + client.user.tag);
    const rest = new REST({ version: '10' }).setToken(client.token);
    try {
        const result = await rest.get(Routes.applicationEmojis(client.user.id));
        const emojis = result.items || result;
        let output = "";
        if (Array.isArray(emojis)) {
            emojis.forEach(e => {
                output += `    "${e.name}": "${e.id}",\n`;
            });
            const fs = require('fs');
            fs.writeFileSync('app_emojis.txt', output);
            console.log(`Found ${emojis.length} application emojis!`);
        } else {
            console.log('Unknown response structure:', result);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
});

client.login(process.env.TOKEN).catch(console.error);
