require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    const guildId = '1441769969133293621'; // TurkLion Network
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    
    if (!guild) {
        console.log("Sunucu bulunamadı.");
        process.exit(1);
    }
    
    await guild.roles.fetch();
    await guild.channels.fetch();
    
    const data = {
        roles: [],
        channels: []
    };
    
    // Roles
    guild.roles.cache.forEach(role => {
        data.roles.push({
            id: role.id,
            name: role.name,
            permissions: role.permissions.toArray()
        });
    });
    
    // Channels
    guild.channels.cache.forEach(channel => {
        const overrides = [];
        if(!channel.permissionOverwrites || !channel.permissionOverwrites.cache) return; channel.permissionOverwrites.cache.forEach(overwrite => {
            const roleOrUser = guild.roles.cache.get(overwrite.id) ? 'Role: ' + guild.roles.cache.get(overwrite.id).name : 'User: ' + overwrite.id;
            overrides.push({
                target: roleOrUser,
                allow: new PermissionsBitField(overwrite.allow.bitfield).toArray(),
                deny: new PermissionsBitField(overwrite.deny.bitfield).toArray()
            });
        });
        
        data.channels.push({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            overrides: overrides
        });
    });
    
    fs.writeFileSync('turklion_data.json', JSON.stringify(data, null, 2));
    console.log("Data saved to turklion_data.json");
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
