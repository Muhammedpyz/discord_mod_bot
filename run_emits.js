require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
    console.log(`[Gerçek Test] Başlıyor...`);
    const guildId = '1062369725067304990';
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) return process.exit(1);

    const member = await guild.members.fetch(client.user.id);
    const channel = guild.channels.cache.filter(c => c.isTextBased()).first();
    const voiceChannel = guild.channels.cache.filter(c => c.isVoiceBased()).first();

    // 1. KÜFÜR FİLTRESİ TESTİ
    const swearMessage = {
        author: { id: '999', bot: false, tag: 'TestUser#1234' },
        member: { id: '999', roles: { cache: new Map() }, permissions: { has: ()=>false } },
        guild: guild,
        channel: channel,
        content: 'orospu çocuğu',
        delete: async () => console.log('[Silindi] Küfürlü mesaj silindi'),
        channelId: channel.id
    };
    console.log("-> Küfür filtresi tetikleniyor...");
    const messageCreate = require('./events/messageCreate.js');
    await messageCreate.execute(swearMessage, client);

    // 2. SES KANALI GİRİŞ VE KAMERA AÇMA TESTİ
    const oldState = { guild: guild, member: member, channelId: null, selfVideo: false };
    const newState = { guild: guild, member: member, channelId: voiceChannel.id, selfVideo: true, streaming: true };
    console.log("-> Ses kanalına giriş ve Kamera/Yayın açma tetikleniyor...");
    const voiceUpdate = require('./events/voiceStateUpdate.js');
    await voiceUpdate.execute(oldState, newState, client);

    // 3. MESAJ SİLİNME TESTİ
    const deletedMessage = {
        author: { id: '999', bot: false, tag: 'TestUser#1234' },
        guild: guild,
        channel: channel,
        content: 'Bu mesaj silinecek!',
        url: 'https://discord.com',
        attachments: { size: 0 }
    };
    console.log("-> Mesaj silinme logu tetikleniyor...");
    const messageDelete = require('./events/messageDelete.js');
    await messageDelete.execute(deletedMessage, client);

    // 4. 3 KERE UYARI -> MUTE SİSTEMİ
    console.log("-> 3. Uyarıdan sonra Mute atma sistemi tetikleniyor...");
    const { issueWarning } = require('./utils/warningManager.js');
    try {
        await issueWarning(guild, '999', client.user.id, 'Test Uyarı 1', 1);
        await issueWarning(guild, '999', client.user.id, 'Test Uyarı 2', 1);
        await issueWarning(guild, '999', client.user.id, 'Test Uyarı 3', 1);
    } catch(e) {}

    console.log("Testler bitti.");
    setTimeout(() => process.exit(0), 4000);
});
client.login(process.env.DISCORD_TOKEN);
