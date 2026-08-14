const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage } = require('./utils/uiBuilder');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
    try {
        const guild = client.guilds.cache.get('1441769969133293621'); // user's test guild
        const channel = guild.channels.cache.find(c => c.isTextBased());
        console.log('Sending to', channel.name);
        
        let answers = [
            { name: "1. Soru", value: "Cevap 1" }
        ];

        const payload = createContainerMessage(
            `🎫 Yeni Yetkili Başvurusu`,
            `<@123> adlı kullanıcı başvuru formunu doldurdu. Lütfen aşağıdaki bilgileri inceleyin.`,
            '#2B2D31',
            [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_accept_123`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`app_reject_123`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
                )
            ],
            answers,
            false
        );

        let pingRolesText = '<@&123>';
        await channel.send({ content: pingRolesText, ...payload });
        console.log('Success');
    } catch(e) {
        console.error('Send Error:', e);
    }
    client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
