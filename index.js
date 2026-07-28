const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const { initDB } = require('./db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const config = require('./config.json');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User
    ]
});
client.on('error', (err) => console.error('[Client Error]:', err));

client.commands = new Collection();
client.spamMap = require('./utils/spamCache'); // Anti-spam için in-memory + JSON cache
client.snipes = new Collection(); // Silinen son mesajlar için (Snipe)

// Event Handler
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    let events = require(filePath);
    
    // Eğer dosya bir event dizisi dönüyorsa
    if (!Array.isArray(events)) {
        events = [events];
    }

    for (const event of events) {
        if (!event.name || !event.execute) continue;
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

// Command Handler
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
        }
    }
}

client.once(Events.ClientReady, async c => {
    console.log(`[Bot] ${c.user.tag} olarak giriş yapıldı!`);
    initDB();
    const { startMuteChecker } = require('./utils/muteChecker');
    startMuteChecker(client, 30000);

    // Snipe hafıza temizliği (1 saate bir eski snipeleri sil)
    setInterval(() => {
        const now = Date.now();
        client.snipes.sweep(snipe => now - snipe.timestamp > 3600000);
    }, 3600000);

    // Spam map temizliği (5 dakikada bir eski verileri sil)
    setInterval(() => {
        const now = Date.now();
        for (const [userId, data] of client.spamMap) {
            if (now - data.lastMessage > 30000) client.spamMap.delete(userId);
        }
    }, 300000);

    console.log(`[Bot] Moderasyon sistemleri aktif.`);

    const statuses = [
        { name: 'turklion.net', type: 3 },
        { name: 'Sunucu Güvenliğini', type: 3 },
        { name: 'Turklion | /yardım', type: 0 },
        { name: 'Turklion | /ayarlar', type: 0 }
    ];
    let statusIndex = 0;
    setInterval(() => {
        const currentStatus = statuses[statusIndex];
        client.user.setActivity(currentStatus.name, { type: currentStatus.type });
        statusIndex = (statusIndex + 1) % statuses.length;
    }, 60000);
});

const startBot = async () => {
    while (true) {
        try {
            await client.login(process.env.DISCORD_TOKEN);
            break;
        } catch (err) {
            console.error('Login failed, retrying in 5s...', err.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
};
startBot();
