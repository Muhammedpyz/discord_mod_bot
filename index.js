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

const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const { initDB, pool } = require('./db');
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
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildInvites
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
            await adminUser.send(`**[Mod Bot] Kritik Hata Yakalandı! (${type})**\n\`\`\`js\n${errDetails}\n\`\`\``).catch(() => {});
        }
    } catch (e) {
        console.error("Hata DM ile gönderilemedi:", e);
    }
}

process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception Yakalandı (Çökme engellendi)]:', err);
    sendErrorDM(err, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection Yakalandı (Çökme engellendi)]:', reason);
    sendErrorDM(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled Rejection');
});

client.on('error', (err) => console.error('[Client Error]:', err));

client.commands = new Collection();
client.spamMap = require('./utils/spamCache'); // Anti-spam için in-memory + JSON cache
client.snipes = new Collection(); // Silinen son mesajlar için (Snipe)
global.botDeletedMessages = new Set(); // Bot veya AutoMod tarafından silinen mesajlar (çift loglamayı önler)

// Müzik Motoru Başlatma (Kazagumo & Shoukaku)
const { initMusicManager } = require('./utils/musicManager');
initMusicManager(client);

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
            const loaded = require(filePath);
            const list = Array.isArray(loaded) ? loaded : [loaded];
            for (const command of list) {
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                }
            }
        }
    }
}

client.once(Events.ClientReady, async c => {
    console.log(`[Bot] ${c.user.tag} olarak giriş yapıldı!`);
    await initDB();
    const { startMuteChecker } = require('./utils/muteChecker');
    startMuteChecker(client, 30000);

    // Otomatik İçerik Göndericiyi Başlat
    const { initScheduler } = require('./utils/scheduler');
    initScheduler(client);

    // Çekiliş (Giveaway) Zamanlayıcısını Başlat
    const { initGiveawayScheduler } = require('./utils/giveawayManager');
    initGiveawayScheduler(client);

    // Canlı Sesli, Kamera ve Yayın XP Motorunu Başlat
    const { initVoiceXpEngine } = require('./utils/levelManager');
    initVoiceXpEngine(client);

    // Başarım (Achievements) bildirim motorunu başlat
    const { initAchievements } = require('./utils/achievements');
    initAchievements(client);

    // Sistem Durumunu Geri Yükleme (Ses XP sayaçları, Özel odalar vb.)
    const { restoreSystemState } = require('./utils/systemRestore');
    await restoreSystemState(client).catch(err => console.error('[Sistem Kurtarma Hatası]:', err));

    // Bilet Hareketsizlik Zamanlayıcısı devre dışı bırakıldı (kullanıcı talimatı: periyodik döngü ve mesaj spamı önleme)
    // const { startTicketInactivityScheduler } = require('./utils/ticketSystem');
    // startTicketInactivityScheduler(client);

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

    // Vanity periyodik tarama (10 dakikada bir: yazı varsa rol ver, yazı silindiyse rolü al)
    const { runVanityScan } = require('./utils/securityPanelHandler');
    let vanityScanRunning = false;
    setInterval(async () => {
        if (vanityScanRunning) return;
        vanityScanRunning = true;
        try {
            const db = require('./db');
            for (const guild of client.guilds.cache.values()) {
                const cfg = await db.getVanityConfig(guild.id).catch(() => null);
                if (cfg && cfg.is_enabled && cfg.vanity_string && cfg.role_id) {
                    await runVanityScan(guild).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[Vanity] Periyodik tarama hatası:', e.message);
        } finally {
            vanityScanRunning = false;
        }
    }, 600000);

    console.log(`[Bot] Moderasyon sistemleri aktif.`);

    // Aktif Bilet Kanalları Bellek Önbelleği (Kanal adı ne olursa olsun mesajları anında yakalar)
    global.activeTicketChannels = new Set();
    try {
        const activeRows = await pool.query("SELECT channel_id FROM tickets WHERE status = 'open'");
        for (const r of activeRows) {
            if (r.channel_id) global.activeTicketChannels.add(r.channel_id);
        }
        console.log(`[TicketSystem] ${global.activeTicketChannels.size} aktif bilet kanalı önbelleğe yüklendi.`);
    } catch(e) {
        console.error('[TicketSystem] Aktif bilet önbellek hatası:', e.message);
    }

    const statuses = [
        { name: 'Nyx Dashboard', type: 3 }, // İzliyor
        { name: 'Muhammedpyz', type: 0 }, // Oynuyor
        { name: 'Nyx | /yardım', type: 0 }, // Oynuyor
        { name: 'Topluluğu', type: 3 }, // İzliyor
        { name: '7/24 Aktif Hizmet', type: 0 }, // Oynuyor
        { name: 'Nyx | /sorgu', type: 2 } // Dinliyor
    ];
    
    client.invites = new Map();
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            if (guild.members?.me?.permissions?.has('ManageGuild')) {
                const firstInvites = await guild.invites.fetch().catch(() => null);
                if (firstInvites) {
                    client.invites.set(guildId, new Map(firstInvites.map(invite => [invite.code, invite.uses])));
                }
            }
        } catch (e) {}
    }
    
    let statusIndex = 0;
    setInterval(() => {
        const currentStatus = statuses[statusIndex];
        client.user.setActivity(currentStatus.name, { type: currentStatus.type });
        statusIndex = (statusIndex + 1) % statuses.length;
    }, 60000);

    // Initial Developer Presence Sync & Polling
    refreshDevPresence();
    setInterval(refreshDevPresence, 10000);
});

const { setCache } = require('./utils/redis');

async function syncDevPresence(presence) {
    try {
        if (!presence || presence.status === 'offline') {
            await setCache('dev:presence', {
                status: 'offline',
                activities: [],
                updatedAt: Date.now()
            }, 86400);
            return;
        }

        const status = presence.status;
        const rawActivities = presence.activities || [];
        const activities = rawActivities.map(act => ({
            name: act.name,
            type: act.type,
            state: act.state || null,
            details: act.details || null
        }));

        await setCache('dev:presence', {
            status,
            activities,
            updatedAt: Date.now()
        }, 86400);
    } catch (e) {
        console.error('[DevPresence Sync Error]:', e);
    }
}

async function refreshDevPresence() {
    try {
        let activePresence = null;
        for (const guild of client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch({ user: SUPER_ADMIN_ID, withPresences: true }).catch(() => null);
                if (member && member.presence && member.presence.status && member.presence.status !== 'offline') {
                    activePresence = member.presence;
                    break;
                }
            } catch (e) {}
        }

        if (activePresence) {
            await syncDevPresence(activePresence);
        } else {
            await syncDevPresence(null);
        }
    } catch (err) {
        console.error('[DevPresence Refresh Error]:', err);
    }
}

client.on(Events.PresenceUpdate, (oldP, newP) => {
    const targetId = newP?.userId || oldP?.userId;
    if (targetId === SUPER_ADMIN_ID) {
        if (newP && newP.status && newP.status !== 'offline') {
            syncDevPresence(newP);
        } else {
            refreshDevPresence();
        }
    }
});

const startBot = async () => {
    try {
        await client.login(process.env.DISCORD_TOKEN);
    } catch (err) {
        console.error('Login failed, retrying in 5s...', err.message);
        setTimeout(startBot, 5000);
    }
};
startBot();
