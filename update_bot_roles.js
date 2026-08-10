require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    const guild = await client.guilds.fetch('1441769969133293621').catch(() => null);
    if (!guild) process.exit(1);
    
    await guild.roles.fetch();
    
    const botRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'bots' || r.name.toLowerCase() === 'bot' || r.name.toLowerCase().includes('bot'));
    const ekoRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'ekosistem');
    
    const targetPerms = [PermissionsBitField.Flags.Administrator];
    
    if (botRole) {
        try { await botRole.setPermissions(targetPerms); console.log(`Güncellendi: ${botRole.name}`); } catch(e){}
    }
    if (ekoRole) {
        try { await ekoRole.setPermissions(targetPerms); console.log(`Güncellendi: ${ekoRole.name}`); } catch(e){}
    }
    
    console.log("İşlem tamam.");
    process.exit(0);
});
client.login(process.env.DISCORD_TOKEN);
