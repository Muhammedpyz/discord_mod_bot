const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage } = require('./utils/uiBuilder');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
    try {
        const guild = client.guilds.cache.get('1441769969133293621'); // user's test guild
        const channel = guild.channels.cache.find(c => c.isTextBased());
        
        let answers = [
            { name: "1. Soru", value: "Cevap 1" }
        ];

        const payload = createContainerMessage(
            `Test Başvuru`,
            `Açıklama`,
            '#2B2D31',
            [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`test_btn`).setLabel('Test').setStyle(ButtonStyle.Success)
                )
            ],
            answers,
            false
        );

        const msg = await channel.send(payload);
        console.log(JSON.stringify(msg.components, null, 2));
    } catch(e) {
        console.error('Send Error:', e);
    }
    client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
