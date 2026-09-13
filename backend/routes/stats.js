const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool } = require('../../db');
const { verifyToken } = require('../middleware/auth');
const { sanitizeString } = require('../security');
const { dataChanged } = require('../../utils/cacheEvents');

function proxyCdn(url) {
  if (!url) return null;
  return `/api/proxy/discord-image?url=${encodeURIComponent(url)}`;
}

async function fetchDiscord(endpoint, token) {
  const startTime = Date.now();
  try {
    const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
      headers: {
        Authorization: 'Bot ' + token,
        'User-Agent': 'DiscordBot (https://discord.com, 1.0.0)'
      }
    });
    const ping = Date.now() - startTime;
    if (!res.ok) return { data: null, ping };
    const data = await res.json();
    return { data, ping };
  } catch(e) {
    return { data: null, ping: 0 };
  }
}

function getDynamicCommands() {
  const commandsDir = path.join(__dirname, '../../commands');
  
  // Klasör bazlı ana kategori haritası
  const folderCategoryMap = {
    'moderation': 'Moderasyon',
    'music': 'Müzik',
    'giveaway': 'Çekiliş & Güvenlik',
    'private_rooms': 'Özel Odalar & Bilet',
    'security': 'Çekiliş & Güvenlik',
    'utility': 'Araçlar & Eğlence',
    'economy': 'Ekonomi & Market',
    'fun': 'Eğlence & Oyunlar'
  };

  const commandNameCategoryMap = {
    // Özel Odalar & Bilet
    'ticket': 'Özel Odalar & Bilet',
    'ozel-oda': 'Özel Odalar & Bilet',
    'odapanel': 'Özel Odalar & Bilet',

    // Çekiliş & Güvenlik
    'giveaway': 'Çekiliş & Güvenlik',
    'vanity': 'Çekiliş & Güvenlik',
    'backup': 'Çekiliş & Güvenlik',
    'automod': 'Çekiliş & Güvenlik',
    'blacklist': 'Çekiliş & Güvenlik',
    'lockdown': 'Çekiliş & Güvenlik',

    // Seviye & Sıralama
    'rank': 'Seviye & Sıralama',
    'top': 'Seviye & Sıralama',
    'level': 'Seviye & Sıralama',
    'rol-bilgi': 'Seviye & Sıralama',

    // Oyun Entegrasyonları
    'mc': 'Oyun Entegrasyonları',
    'mc-sunucu': 'Oyun Entegrasyonları',
    'roblox': 'Oyun Entegrasyonları',
    'steam': 'Oyun Entegrasyonları',

    // Hatırlatıcı & Görevler
    'hatirlat': 'Hatırlatıcı & Görevler',
    'gorev': 'Hatırlatıcı & Görevler',
    'geri-sayım': 'Hatırlatıcı & Görevler',

    // Topluluk Araçları
    'anket': 'Topluluk Araçları',
    'starboard': 'Topluluk Araçları',
    'yapiskan': 'Topluluk Araçları',
    'ozel-komut': 'Topluluk Araçları',
    'oneri': 'Topluluk Araçları',
    'yetkili-basvuru': 'Topluluk Araçları',
    'yetkili-panosu': 'Topluluk Araçları',
    'kurallar': 'Topluluk Araçları',
    'etkinlik': 'Topluluk Araçları',
    'tanıtım': 'Topluluk Araçları',
    'itibar': 'Topluluk Araçları',
    'icerik-uretici': 'Topluluk Araçları',
    'oy-ver': 'Topluluk Araçları',
    'oy-ayarla': 'Topluluk Araçları',
    'buton-rol': 'Topluluk Araçları',

    // Sosyal & Profil
    'sosyal-medya': 'Sosyal & Profil',
    'dogumgunu': 'Sosyal & Profil',
    'hakkımda': 'Sosyal & Profil',
    'profil': 'Sosyal & Profil',
    'notlarım': 'Sosyal & Profil',
    'basarim': 'Sosyal & Profil',
    'ailem': 'Sosyal & Profil',
    'evlat-edin': 'Sosyal & Profil',
    'evlatlıktan-red': 'Sosyal & Profil',
    'evlen': 'Sosyal & Profil',
    'boşan': 'Sosyal & Profil',
    'spotify': 'Sosyal & Profil',

    // Ekonomi & Market
    'ekonomi': 'Ekonomi & Market',
    'market-yonet': 'Ekonomi & Market'
  };

  const categories = {};
  let totalCount = 0;

  if (fs.existsSync(commandsDir)) {
    const dirs = fs.readdirSync(commandsDir);
    dirs.forEach(dir => {
      const dirPath = path.join(commandsDir, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
        files.forEach(file => {
          try {
            const filePath = path.join(dirPath, file);
            delete require.cache[require.resolve(filePath)];
            const loaded = require(filePath);
            const cmdList = Array.isArray(loaded) ? loaded : [loaded];
            cmdList.forEach(cmd => {
              if (cmd && cmd.data) {
                const cmdJson = typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data;
                const cmdName = cmdJson.name;
                const fileBaseName = file.replace('.js', '');
                const catName = commandNameCategoryMap[cmdName] || commandNameCategoryMap[fileBaseName] || folderCategoryMap[dir] || 'Araçlar & Eğlence';
                if (!categories[catName]) categories[catName] = [];

                let usage = '/' + cmdName;
                const opts = [];
                if (cmdJson.options && cmdJson.options.length > 0) {
                  cmdJson.options.forEach(opt => {
                    if (opt.type === 1) {
                      usage += ' ' + opt.name;
                      if (opt.options && opt.options.length > 0) {
                        opt.options.forEach(subOpt => {
                          if (subOpt.required) usage += ` <${subOpt.name}>`;
                          else usage += ` [${subOpt.name}]`;
                          opts.push({
                            name: `${opt.name} ${subOpt.name}`,
                            description: subOpt.description || '',
                            required: !!subOpt.required
                          });
                        });
                      } else {
                        opts.push({
                          name: opt.name,
                          description: opt.description || '',
                          required: false
                        });
                      }
                    } else if (opt.type === 2) {
                      usage += ' ' + opt.name;
                    } else {
                      if (opt.required) usage += ` <${opt.name}>`;
                      else usage += ` [${opt.name}]`;
                      opts.push({
                        name: opt.name,
                        description: opt.description || '',
                        required: !!opt.required
                      });
                    }
                  });
                }

                let permLabel = 'Herkes Kullanabilir';
                if (cmdJson.default_member_permissions) {
                  try {
                    const p = BigInt(cmdJson.default_member_permissions);
                    if ((p & 8n) === 8n) permLabel = 'Yönetici';
                    else if ((p & 4n) === 4n) permLabel = 'Üyeleri Yasakla';
                    else if ((p & 2n) === 2n) permLabel = 'Üyeleri At';
                    else if ((p & 1099511627776n) === 1099511627776n) permLabel = 'Moderatör';
                    else if ((p & 268435456n) === 268435456n) permLabel = 'Rolleri Yönet';
                    else if ((p & 16n) === 16n) permLabel = 'Kanalları Yönet';
                    else permLabel = 'Yetkili';
                  } catch(e) {
                    permLabel = 'Yetkili';
                  }
                }

                categories[catName].push({
                  name: '/' + cmdName,
                  description: cmdJson.description || 'Açıklama bulunmuyor',
                  usage: usage,
                  permission: permLabel,
                  options: opts
                });
                totalCount++;
              }
            });
          } catch (e) {}
        });
      }
    });
  }

  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  const orderedCategoryNames = [
    'Moderasyon',
    'Müzik',
    'Ekonomi & Market',
    'Eğlence & Oyunlar',
    'Çekiliş & Güvenlik',
    'Özel Odalar & Bilet',
    'Topluluk Araçları',
    'Sosyal & Profil',
    'Seviye & Sıralama',
    'Oyun Entegrasyonları',
    'Hatırlatıcı & Görevler',
    'Araçlar & Eğlence'
  ];

  const orderedCategories = {};
  for (const name of orderedCategoryNames) {
    if (categories[name] && categories[name].length > 0) {
      orderedCategories[name] = categories[name];
    }
  }
  for (const name of Object.keys(categories)) {
    if (!orderedCategories[name]) {
      orderedCategories[name] = categories[name];
    }
  }

  return { categories: orderedCategories, totalCount };
}

async function getDatabaseLiveStats() {
  let dbStats = { mutes: 0, warnings: 0, tickets: 0, roleMemories: 0 };
  let conn;
  try {
    conn = await pool.getConnection();
    const [mRows] = await conn.query('SELECT COUNT(*) as cnt FROM mutes');
    const [wRows] = await conn.query('SELECT COUNT(*) as cnt FROM warnings');
    const [tRows] = await conn.query('SELECT COUNT(*) as cnt FROM tickets');
    const [rRows] = await conn.query('SELECT COUNT(*) as cnt FROM role_memory');
    dbStats = {
      mutes: Number(mRows?.cnt || 0),
      warnings: Number(wRows?.cnt || 0),
      tickets: Number(tRows?.cnt || 0),
      roleMemories: Number(rRows?.cnt || 0)
    };
  } catch(e) {
  } finally {
    if (conn) conn.release();
  }
  return dbStats;
}

// ═══════════════════════════════════════════════════════
// REDIS CACHE LAYER — Her istekte Discord API'ye gitmez
// ═══════════════════════════════════════════════════════
const { getCache, setCache } = require('../../utils/redis');

// Komutları ayrıca cache'le (dosya tarama pahalı, 5dk TTL)
let commandsCache = null;
let commandsCacheTime = 0;
const COMMANDS_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

function getCachedCommands() {
  if (commandsCache && (Date.now() - commandsCacheTime) < COMMANDS_CACHE_TTL) {
    return commandsCache;
  }
  commandsCache = getDynamicCommands();
  commandsCacheTime = Date.now();
  return commandsCache;
}

// File system watcher for commands directory to trigger cache invalidation on changes
let commandsChangeTimeout = null;
const handleCommandsChange = () => {
  if (commandsChangeTimeout) {
    clearTimeout(commandsChangeTimeout);
  }
  commandsChangeTimeout = setTimeout(() => {
    try {
      dataChanged('commands_changed');
      console.log('[CommandsWatcher] Commands directory changed, invalidating cache');
    } catch (e) {
      console.error('[CommandsWatcher] Error triggering dataChanged:', e.message);
    }
  }, 500); // 500ms debounce
};

const commandsDir = path.join(__dirname, '../../commands');
if (fs.existsSync(commandsDir)) {
  fs.watch(commandsDir, { recursive: true }, (eventType, filename) => {
    // Trigger on change or rename events
    if (eventType === 'change' || eventType === 'rename') {
      handleCommandsChange();
    }
  });
  console.log(`[CommandsWatcher] Watching for changes in ${commandsDir}`);
} else {
console.warn(`[CommandsWatcher] Commands directory not found: ${commandsDir}`);
}
 


router.get('/', async (req, res) => {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'DISCORD_TOKEN bulunamadı.' });
  }

  // Redis cache kontrolü — 60 saniye TTL
  try {
    const cached = await getCache('web:stats');
    if (cached) {
      return res.json(cached);
    }
  } catch (e) {}

  try {
    const userRes = await fetchDiscord('/users/@me', token);
    const user = userRes.data;
    const apiPing = userRes.ping;

    if (!user || !user.id) {
      return res.status(401).json({ error: 'Geçersiz Bot Tokeni' });
    }

    const guildsRes = await fetchDiscord('/users/@me/guilds?with_counts=true', token);
    const guilds = guildsRes.data || [];

    let totalGuilds = Array.isArray(guilds) ? guilds.length : 0;
    let totalMembers = 0;
    if (Array.isArray(guilds)) {
      guilds.forEach(g => totalMembers += (g.approximate_member_count || 0));
    }

    // Developer Discord Profile (Muhammedpyz ID: 651790387198820425)
    let devProfile = null;
    try {
      const devRes = await fetchDiscord('/users/651790387198820425', token);
      const devUser = devRes.data;

      if (devUser && devUser.id) {
        const createdAt = new Date(Number(BigInt(devUser.id) >> 22n) + 1420070400000).toISOString();
        const flags = devUser.public_flags || 0;
        const BADGES = {
          1: 'Discord Çalışanı',
          2: 'Partner Sunucu Sahibi',
          4: 'HypeSquad Events',
          8: 'Bug Hunter Level 1',
          64: 'HypeSquad Bravery',
          128: 'HypeSquad Brilliance',
          256: 'HypeSquad Balance',
          512: 'Erken Destekçi',
          16384: 'Bug Hunter Level 2',
          131072: 'Onaylı Geliştirici',
          4194304: 'Aktif Geliştirici'
        };
        const badges = Object.entries(BADGES)
          .filter(([bit]) => (flags & Number(bit)) === Number(bit))
          .map(([, name]) => name);

        let bio = null;
        try {
          const dbBio = await pool.query('SELECT bio FROM developer_profile WHERE user_id = ? LIMIT 1', [devUser.id]);
          if (dbBio && dbBio.length > 0 && dbBio[0].bio) {
            bio = dbBio[0].bio;
          }
        } catch (err) {}

        let devPresence = null;
        try {
          devPresence = await getCache('dev:presence');
        } catch(e) {}

        devProfile = {
          id: devUser.id,
          username: devUser.username,
          globalName: devUser.global_name || devUser.username,
          avatar: devUser.avatar ? proxyCdn(`https://cdn.discordapp.com/avatars/${devUser.id}/${devUser.avatar}.png?size=512`) : null,
          banner: devUser.banner ? proxyCdn(`https://cdn.discordapp.com/banners/${devUser.id}/${devUser.banner}.${devUser.banner.startsWith('a_') ? 'gif' : 'png'}?size=1024`) : null,
          bannerColor: devUser.banner_color || '#0d0d0f',
          badges: badges,
          createdAt: createdAt,
          bio: bio || null,
          presence: devPresence || { status: 'offline', activities: [] }
        };
      }
    } catch (devErr) {
      console.error('Error fetching full dev profile:', devErr.message);
    }

    // Dynamic Commands Scanner (memory cached 5dk)
    const { categories, totalCount } = getCachedCommands();

    // Live Database Analytics
    const dbAnalytics = await getDatabaseLiveStats();

    // Dynamic Target Server details
    const targetGuildId = (guilds && guilds.length > 0 ? guilds[0].id : null) || '1062369725067304990';
    const serverRes = await fetchDiscord(`/guilds/${targetGuildId}?with_counts=true`, token);
    const serverGuild = serverRes.data;

    let serverCard = null;
    if (serverGuild && serverGuild.id) {
      serverCard = {
        id: serverGuild.id,
        name: serverGuild.name,
        description: serverGuild.description || `${serverGuild.name} Topluluk & Destek Sunucusu`,
        icon: serverGuild.icon ? proxyCdn(`https://cdn.discordapp.com/icons/${serverGuild.id}/${serverGuild.icon}.png?size=512`) : null,
        banner: serverGuild.banner ? proxyCdn(`https://cdn.discordapp.com/banners/${serverGuild.id}/${serverGuild.banner}.png?size=1024`) : (serverGuild.splash ? proxyCdn(`https://cdn.discordapp.com/splashes/${serverGuild.id}/${serverGuild.splash}.png?size=1024`) : null),
        splash: serverGuild.splash ? proxyCdn(`https://cdn.discordapp.com/splashes/${serverGuild.id}/${serverGuild.splash}.png?size=1024`) : null,
        memberCount: serverGuild.approximate_member_count || 34,
        onlineCount: serverGuild.approximate_presence_count || 7,
        boostTier: serverGuild.premium_tier || 0,
        boostCount: serverGuild.premium_subscription_count || 0,
        inviteUrl: "https://discord.gg/ymrEJTjqJ3"
      };
    }

    const responseData = {
      bot: {
        id: user.id,
        username: user.username,
        avatar: user.avatar ? proxyCdn(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`) : null,
        banner: user.banner ? proxyCdn(`https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=1024`) : null,
        bannerColor: user.banner_color || '#5865F2',
        tag: `${user.username}#${user.discriminator || '0000'}`,
        bio: user.bio && user.bio.trim() !== '' ? user.bio : "Nyx - MariaDB & Redis Altyapılı Gelişmiş Discord All-in-One Botu",
        inviteUrl: `https://discord.com/oauth2/authorize?client_id=${user.id}&permissions=8&integration_type=0&scope=bot+applications.commands`
      },
      stats: {
        servers: totalGuilds,
        users: totalMembers,
        ping: apiPing,
        commandCount: totalCount
      },
      devProfile: devProfile,
      dbAnalytics: dbAnalytics,
      commandCategories: categories,
      serverCard: serverCard
    };

    // Redis'e 60 saniye cache'le
    try {
      await setCache('web:stats', responseData, 60);
    } catch (e) {}

    res.json(responseData);
  } catch (err) {
    console.error('Stats endpoint error:', err);
    res.status(500).json({ error: 'İstatistikler alınırken hata oluştu.' });
  }
});

router.post('/developer-bio', verifyToken, async (req, res) => {
  if (!req.user || req.user.id !== '651790387198820425' || !req.user.isDev) {
    return res.status(403).json({ error: 'Yetkisiz işlem. Sadece doğrulanmış bot geliştiricisi biyografi güncelleyebilir.' });
  }

  const { bio } = req.body || {};
  const sanitizedBio = typeof bio === 'string' ? sanitizeString(bio, { maxLength: 400, allowEmpty: true }) : '';

  try {
    await pool.query(
      'INSERT INTO developer_profile (user_id, bio) VALUES (?, ?) ON DUPLICATE KEY UPDATE bio = VALUES(bio)',
      [req.user.id, sanitizedBio]
    );
    res.json({ success: true, bio: sanitizedBio });
  } catch (e) {
    console.error('Developer bio update error:', e);
    res.status(500).json({ error: 'Biyografi güncellenirken sunucu hatası oluştu.' });
  }
});

module.exports = router;
