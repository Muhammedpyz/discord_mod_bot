require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    const guild = await client.guilds.fetch('1441769969133293621').catch(() => null);
    if (!guild) process.exit(1);
    
    await guild.roles.fetch();
    const oyuncu = guild.roles.cache.find(r => r.name === 'Oyuncu');
    const everyone = guild.roles.everyone;
    
    await guild.channels.fetch();
    
    // Find category IDs
    const personelCat = guild.channels.cache.find(c => c.name.toLowerCase() === 'personel' || c.name.toLowerCase().includes('personel'));
    const yonetimCat = guild.channels.cache.find(c => c.name.toLowerCase() === 'yönetim' || c.name.toLowerCase().includes('yönetim'));
    
    const catIds = [];
    if (personelCat) catIds.push(personelCat.id);
    if (yonetimCat) catIds.push(yonetimCat.id);
    
    const targetNames = ['yapılcaklar-liste', 'server-önerileri', 'giriş-çıkış', 'yüksek-güvenlikli-oda'];
    
    for (const [id, ch] of guild.channels.cache) {
        let isStaffChannel = false;
        
        // Kategoriye aitse
        if (ch.parentId && catIds.includes(ch.parentId)) {
            isStaffChannel = true;
        }
        
        // İsmi listedeyse
        if (targetNames.some(name => ch.name.toLowerCase().includes(name))) {
            isStaffChannel = true;
        }
        
        // Zaten kategori ise ve ismi personel/yönetim ise
        if (ch.type === 4 && (ch.name.toLowerCase().includes('personel') || ch.name.toLowerCase().includes('yönetim'))) {
            isStaffChannel = true;
        }

        if (isStaffChannel) {
            try {
                await ch.permissionOverwrites.edit(everyone.id, { ViewChannel: false });
                if (oyuncu) await ch.permissionOverwrites.edit(oyuncu.id, { ViewChannel: false });
                console.log(`Gizlendi: ${ch.name}`);
            } catch (e) {
                console.log(`Hata: ${ch.name}`);
            }
        }
    }
    console.log("Fix tamam");
    process.exit(0);
});
client.login(process.env.DISCORD_TOKEN);
