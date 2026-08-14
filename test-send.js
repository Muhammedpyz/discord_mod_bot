const { Client, GatewayIntentBits } = require('discord.js');
const { buildModBResponse } = require('./utils/uiBuilder');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
    try {
        const guild = client.guilds.cache.get('1441769969133293621'); // user's test guild
        const channel = guild.channels.cache.find(c => c.isTextBased());
        console.log('Sending to', channel.name);
        const payload = buildModBResponse({ textLines: ['Test panel'] });
        await channel.send(payload);
        console.log('Success');
    } catch(e) {
        console.error('Send Error:', e);
    }
    client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
