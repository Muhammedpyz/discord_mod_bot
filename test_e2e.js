require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
    console.log(`[Test E2E] Bot hazır: ${client.user.tag}`);
    const guildId = '1062369725067304990'; // FarLands
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(()=>null);
    if (!guild) return console.log("Sunucu bulunamadı!");

    const member = await guild.members.fetch(client.user.id);
    const channel = guild.channels.cache.filter(c => c.isTextBased()).first();

    const mockOptions = {
        user: member.user,
        member: member,
        reason: 'Otomatik Yapay Zeka Testi',
        sure: '1m',
        zaman: '1m',
        category: 'genel',
        amount: 2,
        state: 'lock'
    };

    const createCommandInteraction = (commandName) => ({
        isCommand: () => true,
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        commandName: commandName,
        guildId: guild.id,
        guild: guild,
        user: member.user,
        member: member,
        channel: channel,
        options: {
            getUser: () => mockOptions.user,
            getString: (name) => mockOptions[name],
            getInteger: (name) => mockOptions[name],
            getSubcommand: () => null
        },
        reply: async (data) => console.log(`[/${commandName}] Reply başarılı.`),
        deferReply: async () => console.log(`[/${commandName}] Defer başarılı.`),
        editReply: async (data) => console.log(`[/${commandName}] EditReply başarılı.`),
        followUp: async (data) => console.log(`[/${commandName}] FollowUp başarılı.`)
    });

    const createButtonInteraction = (customId) => ({
        isCommand: () => false,
        isButton: () => true,
        isStringSelectMenu: () => false,
        customId: customId,
        guildId: guild.id,
        guild: guild,
        user: member.user,
        member: member,
        channel: channel,
        message: { id: '123456789' },
        reply: async (data) => console.log(`[Button:${customId}] Reply başarılı.`),
        deferReply: async () => console.log(`[Button:${customId}] Defer başarılı.`),
        deferUpdate: async () => console.log(`[Button:${customId}] DeferUpdate başarılı.`),
        editReply: async (data) => console.log(`[Button:${customId}] EditReply başarılı.`)
    });

    // 1. TÜM KOMUTLARI TEST ET
    console.log("\n--- KOMUT TESTLERİ (SLASH) ---");
    const commandFiles = fs.readdirSync('./commands/moderation').filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const cmd = require(`./commands/moderation/${file}`);
            if (cmd.execute) {
                await cmd.execute(createCommandInteraction(cmd.data ? cmd.data.name : file.split('.')[0]), client);
                console.log(`✅ ${file} başarıyla test edildi.`);
            }
        } catch (err) {
            console.log(`❌ HATA - ${file}: ${err.message}`);
        }
    }

    // 2. BUTONLARI TEST ET (interactionCreate.js)
    console.log("\n--- BUTON TESTLERİ ---");
    const interactionCreate = require('./events/interactionCreate.js');
    const buttonsToTest = [
        `mute_${member.user.id}`,
        `ban_${member.user.id}`,
        `warn_${member.user.id}`,
        `ticket_create`
    ];
    for (const btnId of buttonsToTest) {
        try {
            await interactionCreate.execute(createButtonInteraction(btnId), client);
            console.log(`✅ Buton '${btnId}' başarıyla test edildi.`);
        } catch (err) {
            console.log(`❌ HATA - Buton '${btnId}': ${err.message}`);
        }
    }

    console.log("\n[Test E2E] Tüm simülasyon tamamlandı.");
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
