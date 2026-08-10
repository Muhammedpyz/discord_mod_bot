require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
    console.log("Simulating member add...");
    const guild = client.guilds.cache.get('1062369725067304990') || await client.guilds.fetch('1062369725067304990').catch(()=>null);
    if(guild) {
        const member = await guild.members.fetch(client.user.id);
        const guildMemberAdd = require('./events/guildMemberAdd.js');
        await guildMemberAdd.execute(member, client);
    }
    setTimeout(() => process.exit(0), 3000);
});
client.login(process.env.DISCORD_TOKEN);
