require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { getGuildConfig } = require('./db');
const { sendLog, sendVoiceLog } = require('./utils/logger');
const { createV2Message, COLORS } = require('./utils/uiBuilder');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
    console.log(`[Test] Bot giriş yaptı: ${client.user.tag}`);
    const guildId = '1062369725067304990'; // Farlnads ID (or we can just iterate client.guilds)
    const guild = client.guilds.cache.get(guildId) || client.guilds.cache.first();
    
    if (!guild) {
        console.error("Sunucu bulunamadı!");
        process.exit(1);
    }

    console.log(`[Test] Sunucu bulundu: ${guild.name}`);
    const member = await guild.members.fetch(client.user.id);
    
    // Test 1: Nickname Change
    console.log("[Test] 1. Nickname Log gönderiliyor...");
    const nickPayload = createV2Message({
        title: 'İsim Değişikliği (Nickname)',
        description: `**Kullanıcı:** ${member.user.tag} (<@${member.id}>)\n\n**Eski Adı:** \`TestKullanıcı\`\n**Yeni Adı:** \`YeniTestAdı\``,
        color: COLORS.INFO
    });
    await sendLog(guild, nickPayload, 'system');

    // Test 2: Message Edit
    console.log("[Test] 2. Message Edit Log gönderiliyor...");
    const msgPayload = createV2Message({
        title: 'Mesaj Düzenlendi',
        description: `**Kullanıcı:** ${member.user.tag} (<@${member.id}>)\n**Kanal:** <#${guild.channels.cache.first().id}>\n\n**Eski Mesaj:**\n\`\`\`text\nBu bir deneme eski mesajıdır.\n\`\`\`\n**Yeni Mesaj:**\n\`\`\`text\nBu da deneme yeni mesajıdır!\n\`\`\`\n[Mesaja Git](https://discord.com)`,
        color: COLORS.WARNING
    });
    await sendLog(guild, msgPayload, 'system');

    // Test 3: Channel Created
    console.log("[Test] 3. Channel Created Log gönderiliyor...");
    const chPayload = createV2Message({
        title: 'Kanal Oluşturuldu',
        description: `**Yetkili:** <@${member.id}>\n**Kanal:** <#${guild.channels.cache.first().id}> (\`yeni-deneme-kanali\`)`,
        color: COLORS.WARNING
    });
    await sendLog(guild, chPayload, 'system');

    // Test 4: Voice Log
    console.log("[Test] 4. Voice Log gönderiliyor...");
    await sendVoiceLog(client, guild.id, 'Kanala Katıldı', `<@${member.id}> ses kanalına katıldı: <#${guild.channels.cache.first().id}>`, member.user, 'global');

    // Test 5: Manuel Ceza
    console.log("[Test] 5. Manuel Ceza Log gönderiliyor...");
    const mutePayload = createV2Message({
        title: 'Manuel Ceza İşlemi (Rol)',
        description: `**Kullanıcı:** ${member.user.tag} (<@${member.id}>)\nKullanıcıya Discord üzerinden **Metin Susturma Rolü** eklendiği tespit edildi. Veritabanına işlendi.`,
        color: COLORS.ERROR
    });
    await sendLog(guild, mutePayload, 'system');

    console.log("[Test] Tüm loglar gönderildi!");
    setTimeout(() => process.exit(0), 3000);
});

client.login(process.env.DISCORD_TOKEN);
