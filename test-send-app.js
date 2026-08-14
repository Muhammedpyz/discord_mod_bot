const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildModBResponse } = require('./utils/uiBuilder');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch('1441769969133293621'); // Or any guild in config
        const revChan = guild.channels.cache.first(); // Just get any channel to test
        
        if (!revChan) {
            console.log("No channel found");
            process.exit(1);
        }

        const now = Math.floor(Date.now() / 1000);
        const appBody = `## <:mono:1537768155370496122> Yeni Yetkili Başvurusu
### <:mono:1537768132062486558> Aday
> **Etiket:** <@123456789>
> **Kullanıcı adı:** [testuser](https://discord.com/users/123456789)
> **ID:** \`123456789\`
<:mono:1537768109975277629> **Gönderilme:** <t:${now}:f> (<t:${now}:R>)
<:mono:1537770160021049345> **Durum:** İnceleniyor

### 1. Soru
> Cevap`;

        const payload = buildModBResponse({
            textLines: [appBody],
            actionRows: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_accept_123456789`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`app_reject_123456789`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
                )
            ]
        });

        await revChan.send(payload);
        console.log("SUCCESS!");
    } catch (e) {
        console.error("FAILED TO SEND:", e);
    }
    process.exit(0);
});

client.login(config.token);
