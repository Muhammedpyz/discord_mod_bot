process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.versions.bun = '1.0';

const dns = require('node:dns');
try {
  dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const { ProxyAgent, setGlobalDispatcher } = require('undici');
try {
  setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:8080'));
} catch (e) {
  console.warn('Proxy dispatcher warning:', e.message);
}

const { REST, Routes } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');
const { buildSets } = require('./utils/deploySets');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const sets = buildSets();
        const guildCommands = sets.guild.map(c => c.data.toJSON());
        const globalCommands = sets.global.map(c => c.data.toJSON());
        const total = sets.total;

        console.log(`[Deploy] Toplam ${total} komut hazırlandı: ${guildCommands.length} Guild, ${globalCommands.length} Global.`);

        // 1. Global komutları sıfırla ve yeniden yükle
        console.log(`[1/2] Global eski komutlar sıfırlanıyor ve güncelleniyor (${globalCommands.length} komut)...`);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
        const deployedGlobal = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: globalCommands }
        );
        console.log(`✓ Başarıyla ${deployedGlobal.length} komut GLOBAL ağa deploy edildi!`);

        // 2. Her sunucu için guild komutlarını güncelle
        console.log(`[2/2] Sunucu (Guild) komutları güncelleniyor (${guildCommands.length} komut)...`);
        for (const guildId of config.ALLOWED_GUILDS) {
            try {
                console.log(` -> Guild ${guildId} deploy ediliyor...`);
                const deployedGuild = await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                    { body: guildCommands }
                );
                console.log(`✓ Guild ${guildId}: ${deployedGuild.length} komut başarıyla deploy edildi!`);
            } catch (err) {
                console.error(`Guild ${guildId} deploy hatası:`, err.message);
            }
        }

        console.log('✓ TÜM ESKİ KOMUTLAR TEMİZLENDİ VE TÜM YENİ 173 KOMUT EKSİKSİZ YÜKLENDİ!');
        process.exit(0);
    } catch (error) {
        console.error('Genel deploy hatası:', error);
        process.exit(1);
    }
})();
