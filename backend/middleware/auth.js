const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the app.');
}

const { pool } = require('../../db');
// In-memory cache for user guilds to prevent giant JWT / Cookie HTTP 431 errors
const userGuildsCache = new Map();
const USER_GUILDS_CACHE_TTL = 10 * 60 * 1000; // 10 dakika TTL

async function getUserGuilds(userId) {
  const cached = userGuildsCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < USER_GUILDS_CACHE_TTL)) {
    return cached.guilds;
  }
  try {
    const rows = await pool.query('SELECT guilds_json FROM user_guilds_cache WHERE user_id = ?', [userId]);
    if (rows.length > 0 && rows[0].guilds_json) {
      const guilds = JSON.parse(rows[0].guilds_json);
      userGuildsCache.set(userId, { guilds, timestamp: Date.now() });
      return guilds;
    }
  } catch (err) {
    console.error('Error reading user_guilds_cache from DB:', err.message);
  }
  return [];
}

async function saveUserGuilds(userId, guilds) {
  userGuildsCache.set(userId, { guilds, timestamp: Date.now() });
  try {
    await pool.query(
      'INSERT INTO user_guilds_cache (user_id, guilds_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE guilds_json = VALUES(guilds_json)',
      [userId, JSON.stringify(guilds)]
    );
  } catch (err) {
    console.error('Error saving user_guilds_cache to DB:', err.message);
  }
}

function verifyToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }
}

async function verifyGuildAdmin(req, res, next) {
  const guildId = req.params.guildId;
  if (!guildId) {
    return res.status(400).json({ error: 'Sunucu ID belirtilmedi.' });
  }

  try {
    const guildApiUrl = `https://discord.com/api/v10/guilds/${guildId}`;
    const guildResponse = await fetch(guildApiUrl, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!guildResponse.ok) {
      return res.status(403).json({ error: 'Bu sunucuyu yönetmek için erişim yok.' });
    }

    const guildData = await guildResponse.json();
    const userId = req.user && req.user.id ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ error: 'Kullanıcı bilgisi eksik.' });
    }

    if (guildData.owner_id && guildData.owner_id === userId) {
      return next();
    }

    const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!memberResponse.ok) {
      return res.status(403).json({ error: 'Bu sunucunun üyesi değilsiniz veya erişiminiz yok.' });
    }

    const memberData = await memberResponse.json();
    const permissions = BigInt(memberData.permissions || '0');
    const isAdmin = (permissions & 0x8n) === 0x8n;
    const isManager = (permissions & 0x20n) === 0x20n;

    if (isAdmin || isManager) {
      return next();
    }

    return res.status(403).json({ error: 'Bu sunucuyu yönetmek için Yönetici veya Sunucuyu Yönet yetkisine sahip olmalısınız.' });
  } catch (error) {
    console.error('Guild admin verification failed:', error.message);
    return res.status(500).json({ error: 'Sunucu yetkisi doğrulanamadı.' });
  }
}

module.exports = {
  JWT_SECRET,
  userGuildsCache,
  getUserGuilds,
  saveUserGuilds,
  verifyToken,
  verifyGuildAdmin
};
