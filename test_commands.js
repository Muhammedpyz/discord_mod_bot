require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
    console.log(`[Test] Bot hazır: ${client.user.tag}`);
    const guildId = '1062369725067304990'; // FarLands
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(()=>null);
    if (!guild) return console.log("Sunucu bulunamadı!");

    const member = await guild.members.fetch(client.user.id);
    const targetUser = member.user; // Kendimize işlem yapacağız
    const channel = guild.channels.cache.filter(c => c.isTextBased()).first();

    const mockOptions = {
        user: targetUser,
        member: member,
        reason: 'Otomatik Yapay Zeka Testi',
        sure: '1m',
        zaman: '1m',
        category: 'genel',
        kategori: 'genel',
        amount: 5
    };

    const createInteraction = (optionsMap) => {
        return {
            isCommand: () => true,
            isChatInputCommand: () => true,
            guildId: guild.id,
            guild: guild,
            user: member.user,
            member: member,
            channel: channel,
            options: {
                getUser: (name) => optionsMap.user,
                getString: (name) => optionsMap[name],
                getInteger: (name) => optionsMap[name],
                getSubcommand: () => null
            },
            reply: async (data) => {
                console.log("[Reply] Gönderiliyor...");
                return await channel.send(data).catch(e => console.log(e));
            },
            deferReply: async () => {
                console.log("[Defer] İşlem ertelendi...");
            },
            editReply: async (data) => {
                console.log("[EditReply] Gönderiliyor...");
                return await channel.send(data).catch(e => console.log(e));
            }
        };
    };

    console.log("=== 1. /warn TESTİ ===");
    const warnCommand = require('./commands/moderation/warn.js');
    try {
        await warnCommand.execute(createInteraction(mockOptions), client);
    } catch(e) { console.log(e); }

    await new Promise(r => setTimeout(r, 2000));

    try {
    } catch(e) { console.log(e); }

    await new Promise(r => setTimeout(r, 2000));

    console.log("=== 3. /sorgu TESTİ ===");
    const sorguCommand = require('./commands/moderation/sorgu.js');
    try {
        await sorguCommand.execute(createInteraction(mockOptions), client);
    } catch(e) { console.log(e); }

    await new Promise(r => setTimeout(r, 2000));
    console.log("Tüm testler tamamlandı.");
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
