const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const { initDB } = require('./db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildBans
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User
    ]
});

const SUPER_ADMIN_ID = '651790387198820425';

async function sendErrorDM(err, type) {
    console.error(`[${type}]`, err);
    try {
        const adminUser = await client.users.fetch(SUPER_ADMIN_ID).catch(() => null);
        if (adminUser) {
            const errDetails = err.stack ? err.stack.substring(0, 1900) : err.message;
            await adminUser.send(`🚨 **[Mod Bot] Kritik Hata Yakalandı! (${type})**\n\`\`\`js\n${errDetails}\n\`\`\``).catch(() => {});
        }
    } catch (e) {
        console.error("Hata DM ile gönderilemedi:", e);
    }
}

process.on('uncaughtException', (err) => {
    sendErrorDM(err, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason, promise) => {
    sendErrorDM(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled Rejection');
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
    
    client.invites = new Map();
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            client.invites.set(guildId, new Map(firstInvites.map(invite => [invite.code, invite.uses])));
        } catch (e) {
            console.error(`Davetler çekilemedi: ${guild.name}`);
        }
    }
    
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
