const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once('ready', async () => {
    try {
        const channel = await client.channels.fetch('1441769969133293621'); // I don't know the ticket channel ID. Let's just fetch ANY V2 message.
        // Actually, we don't have a specific message ID. Let's look at uiBuilder.js
    } catch(e) {}
    process.exit(0);
});
client.login(require('./config.json').token);
