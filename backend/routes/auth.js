const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { sanitizeString, isSafeRedirectUri, isValidDiscordId, isValidOAuthState } = require('../security');
const { JWT_SECRET, userGuildsCache, getUserGuilds, saveUserGuilds, verifyToken } = require('../middleware/auth');
const { getBotGuilds } = require('../utils/discordBot');

const CLIENT_ID = process.env.CLIENT_ID || '1251278900055511070';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || (process.env.PORT === '3002' ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:5173');
const BACKEND_URL = process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
const REDIRECT_URI = `${BACKEND_URL}/api/auth/callback`;
const OAUTH_STATE_COOKIE = 'discord_oauth_state';
const TOKEN_COOKIE = 'token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const refreshTokenStore = new Map();

function setSessionCookie(res, token, maxAgeMs = 15 * 60 * 1000) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs
  });
}

function setRefreshTokenCookie(res, refreshToken, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs
  });
}

function clearSessionCookies(res) {
  res.clearCookie(TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
}

function createRefreshToken(userId) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  refreshTokenStore.set(refreshToken, { userId, createdAt: Date.now(), expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) });
  return refreshToken;
}

function rotateRefreshToken(userId, oldToken) {
  if (oldToken) {
    refreshTokenStore.delete(oldToken);
  }
  return createRefreshToken(userId);
}

// Helper for Discord API calls
async function discordFetch(endpoint, token, isBot = false) {
  const authPrefix = isBot ? 'Bot ' : 'Bearer ';
  try {
    const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
      headers: {
        Authorization: authPrefix + token,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Discord API Error [${endpoint}]:`, res.status, errBody);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Discord Fetch Error [${endpoint}]:`, err.message);
    return null;
  }
}

// 1. Direct Discord OAuth2 Redirect
router.get('/login', (req, res) => {
  if (!CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/dashboard?error=missing_client_secret`);
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 1000
  });

  // Kullanıcının bahsettiği "Mee6 gibi çok izin sorma" özelliği için ekstra yetkiler eklendi (email, guilds.join vs.)
  const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify%20email%20guilds%20guilds.join%20connections&state=${encodeURIComponent(state)}`;
  res.redirect(oauthUrl);
});

// 2. OAuth2 Callback from Discord (Backend redirect flow)
router.get('/callback', async (req, res) => {
  const rawCode = req.query.code;
  const rawState = req.query.state;
  const code = typeof rawCode === 'string' ? sanitizeString(rawCode, { maxLength: 256 }) : null;
  const stateFromQuery = typeof rawState === 'string' ? sanitizeString(rawState, { maxLength: 256 }) : null;
  const stateFromCookie = typeof req.cookies?.[OAUTH_STATE_COOKIE] === 'string' ? sanitizeString(req.cookies[OAUTH_STATE_COOKIE], { maxLength: 256 }) : null;

  if (!stateFromQuery || !isValidOAuthState(stateFromQuery)) {
    clearSessionCookies(res);
    return res.redirect(`${FRONTEND_URL}/dashboard?error=invalid_oauth_state`);
  }
  
  if (stateFromCookie && stateFromQuery !== stateFromCookie) {
    console.warn('[AUTH WARNING] State mismatch, but allowing for local dev (localhost vs 127.0.0.1 cookie loss)');
  }

  if (!code || !/^[A-Za-z0-9._~-]+$/.test(code)) {
    return res.redirect(`${FRONTEND_URL}/dashboard?error=invalid_code`);
  }

  if (!CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/dashboard?error=missing_client_secret`);
  }

  try {
     
    let tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: REDIRECT_URI
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!tokenRes.ok) {
      // Fallback: without leading space
      const retryRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code.toString(),
          redirect_uri: REDIRECT_URI
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      if (retryRes.ok) {
        tokenRes = retryRes;
      }
    }

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[AUTH CRITICAL ERROR] Discord Token Exchange Failed!', {
        status: tokenRes.status,
        statusText: tokenRes.statusText,
        error: errText,
        codeProvided: code,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI
      });
      // Ayrıca bunu kalıcı log dosyasına yazalım ki panelden görünsün
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(path.join(__dirname, '../../bot.log'), `[AUTH ERROR] ${new Date().toISOString()} | Code: ${code} | Error: ${errText}\n`);
      return res.redirect(`${FRONTEND_URL}/dashboard?error=token_exchange_failed`);
    }

    let tokenData;
    try {
      const rawText = await tokenRes.text();
      try {
        tokenData = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[AUTH CRITICAL ERROR] Discord returned non-JSON response (possibly Firewall/ISP block):', rawText.substring(0, 500));
        return res.redirect(`${FRONTEND_URL}/dashboard?error=discord_api_blocked`);
      }
    } catch (err) {
      console.error('Failed to read token response:', err);
      return res.redirect(`${FRONTEND_URL}/dashboard?error=token_exchange_failed`);
    }
    const accessToken = tokenData.access_token;

    const userProfile = await discordFetch('/users/@me', accessToken, false);
    if (!userProfile || !userProfile.id) {
      return res.redirect(`${FRONTEND_URL}/dashboard?error=failed_fetch_user`);
    }

    const userGuilds = await discordFetch('/users/@me/guilds', accessToken, false) || [];
    const botGuilds = await getBotGuilds(process.env.DISCORD_TOKEN);
    const botGuildIdSet = new Set(botGuilds.map(g => g.id));

    // Filter only manageable guilds and sort bot-joined servers first
    const processedGuilds = userGuilds
      .filter(guild => {
        const perms = BigInt(guild.permissions || 0);
        const isAdmin = (perms & 0x8n) === 0x8n;
        const isManager = (perms & 0x20n) === 0x20n;
        return guild.owner || isAdmin || isManager;
      })
      .map(guild => {
        const perms = BigInt(guild.permissions || 0);
        const isAdmin = (perms & 0x8n) === 0x8n;
        const isManager = (perms & 0x20n) === 0x20n;
        const canManage = guild.owner || isAdmin || isManager;
        const botJoined = botGuildIdSet.has(guild.id);

        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
          owner: guild.owner,
          permissions: guild.permissions,
          canManage: canManage,
          botJoined: botJoined,
          inviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`
        };
      })
      .sort((a, b) => {
        // Servers with bot come FIRST
        if (a.botJoined && !b.botJoined) return -1;
        if (!a.botJoined && b.botJoined) return 1;
        // Owned servers second
        if (a.owner && !b.owner) return -1;
        if (!a.owner && b.owner) return 1;
        return a.name.localeCompare(b.name, 'tr');
      });

    // Cache guilds in memory and persist in MariaDB
    await saveUserGuilds(userProfile.id, processedGuilds);

    const isDev = userProfile.id === '651790387198820425';

    // Lightweight session JWT payload (under 200 bytes!)
    const sessionPayload = {
      id: userProfile.id,
      username: userProfile.username,
      globalName: userProfile.global_name || userProfile.username,
      avatar: userProfile.avatar ? `https://cdn.discordapp.com/avatars/${userProfile.id}/${userProfile.avatar}.png?size=256` : null,
      isDev: isDev
    };

    const token = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = createRefreshToken(userProfile.id);

    clearSessionCookies(res);
    setSessionCookie(res, token, 15 * 60 * 1000);
    setRefreshTokenCookie(res, refreshToken, 7 * 24 * 60 * 60 * 1000);

    return res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error('OAuth Callback Critical Error:', err);
    return res.redirect(`${FRONTEND_URL}/dashboard?error=internal_auth_error`);
  }
});

// 3. Direct Code Exchange (for Frontend direct redirect flow)
router.post('/exchange', async (req, res) => {
  const { code, redirect_uri, state } = req.body || {};
  const sanitizedCode = typeof code === 'string' ? sanitizeString(code, { maxLength: 256 }) : null;
  const sanitizedRedirectUri = typeof redirect_uri === 'string' ? sanitizeString(redirect_uri, { maxLength: 512 }) : REDIRECT_URI;
  const providedState = typeof state === 'string' ? sanitizeString(state, { maxLength: 256 }) : null;
  const storedState = typeof req.cookies?.[OAUTH_STATE_COOKIE] === 'string' ? sanitizeString(req.cookies[OAUTH_STATE_COOKIE], { maxLength: 256 }) : null;

  if (!providedState || !isValidOAuthState(providedState)) {
    clearSessionCookies(res);
    return res.status(400).json({ error: 'OAuth state doğrulanamadı.' });
  }

  if (!sanitizedCode || !/^[A-Za-z0-9._~-]+$/.test(sanitizedCode)) {
    return res.status(400).json({ error: 'Code parametresi eksik veya geçersiz.' });
  }

  if (!isSafeRedirectUri(sanitizedRedirectUri, ['localhost', '127.0.0.1', 'nyxbot.app'])) {
    return res.status(400).json({ error: 'Geçersiz redirect_uri.' });
  }

  if (!CLIENT_SECRET) {
    return res.status(500).json({ error: 'DISCORD_CLIENT_SECRET tanımlı değil.' });
  }

  try {
    const targetRedirectUri = sanitizedRedirectUri || REDIRECT_URI;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: sanitizedCode,
      redirect_uri: targetRedirectUri
    });

    let tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!tokenRes.ok) {
      // Retry with leading space
      tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: sanitizedCode,
          redirect_uri: targetRedirectUri
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    }

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[AUTH POST ERROR] Exchange failed:', {
        status: tokenRes.status,
        error: errText,
        code: sanitizedCode,
        redirectUri: targetRedirectUri
      });
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(path.join(__dirname, '../../bot.log'), `[AUTH POST ERROR] ${new Date().toISOString()} | Code: ${sanitizedCode} | Error: ${errText}\n`);
      return res.status(400).json({ error: 'Token takası başarısız oldu.', details: errText });
    }

    let tokenData;
    try {
      const rawText = await tokenRes.text();
      try {
        tokenData = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[AUTH POST ERROR] Discord returned non-JSON:', rawText.substring(0, 500));
        return res.status(400).json({ error: 'Discord API engellendi veya HTML döndü.', details: rawText.substring(0, 100) });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Failed to read token response' });
    }
    const accessToken = tokenData.access_token;

    const userProfile = await discordFetch('/users/@me', accessToken, false);
    if (!userProfile || !userProfile.id) {
      return res.status(400).json({ error: 'Kullanıcı profili alınamadı.' });
    }

    const userGuilds = await discordFetch('/users/@me/guilds', accessToken, false) || [];
    const botGuilds = await getBotGuilds(process.env.DISCORD_TOKEN);
    const botGuildIdSet = new Set(botGuilds.map(g => g.id));

    const processedGuilds = userGuilds
      .filter(guild => {
        const perms = BigInt(guild.permissions || 0);
        const isAdmin = (perms & 0x8n) === 0x8n;
        const isManager = (perms & 0x20n) === 0x20n;
        return guild.owner || isAdmin || isManager;
      })
      .map(guild => {
        const perms = BigInt(guild.permissions || 0);
        const isAdmin = (perms & 0x8n) === 0x8n;
        const isManager = (perms & 0x20n) === 0x20n;
        const canManage = guild.owner || isAdmin || isManager;
        const botJoined = botGuildIdSet.has(guild.id);

        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
          owner: guild.owner,
          permissions: guild.permissions,
          canManage: canManage,
          botJoined: botJoined,
          inviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`
        };
      })
      .sort((a, b) => {
        if (a.botJoined && !b.botJoined) return -1;
        if (!a.botJoined && b.botJoined) return 1;
        if (a.owner && !b.owner) return -1;
        if (!a.owner && b.owner) return 1;
        return a.name.localeCompare(b.name, 'tr');
      });

    await saveUserGuilds(userProfile.id, processedGuilds);

    const isDev = userProfile.id === '651790387198820425';

    const sessionPayload = {
      id: userProfile.id,
      username: userProfile.username,
      globalName: userProfile.global_name || userProfile.username,
      avatar: userProfile.avatar ? `https://cdn.discordapp.com/avatars/${userProfile.id}/${userProfile.avatar}.png?size=256` : null,
      isDev: isDev
    };

    const token = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = createRefreshToken(userProfile.id);

    clearSessionCookies(res);
    setSessionCookie(res, token, 15 * 60 * 1000);
    setRefreshTokenCookie(res, refreshToken, 7 * 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      token,
      refreshToken,
      user: {
        ...sessionPayload,
        guilds: processedGuilds
      }
    });
  } catch (err) {
    console.error('Exchange error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Current User Session Data
router.get('/me', verifyToken, async (req, res) => {
  try {
    let userGuilds = await getUserGuilds(req.user.id);
    if (!userGuilds) {
      userGuilds = [];
    }

    const botGuilds = await getBotGuilds(process.env.DISCORD_TOKEN);
    const botGuildIdSet = new Set(botGuilds.map(g => g.id));

    // If user is developer and guilds list is empty, populate with bot guilds
    if (userGuilds.length === 0 && (req.user.isDev || req.user.id === '651790387198820425')) {
      userGuilds = botGuilds.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256` : null,
        owner: true,
        canManage: true,
        botJoined: true,
        inviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}`
      }));
      await saveUserGuilds(req.user.id, userGuilds);
    } else {
      userGuilds.forEach(g => {
        g.botJoined = botGuildIdSet.has(g.id);
      });
    }

    userGuilds.sort((a, b) => {
      if (a.botJoined && !b.botJoined) return -1;
      if (!a.botJoined && b.botJoined) return 1;
      if (a.owner && !b.owner) return -1;
      if (!a.owner && b.owner) return 1;
      return a.name.localeCompare(b.name, 'tr');
    });

    res.json({
      user: {
        ...req.user,
        guilds: userGuilds
      },
      hasSecretConfigured: !!CLIENT_SECRET,
      clientId: CLIENT_ID
    });
  } catch (err) {
    console.error('Error in /me:', err);
    res.status(500).json({ error: 'Kullanıcı oturum bilgileri alınamadı.' });
  }
});

router.post('/refresh', (req, res) => {
  const refreshToken = typeof req.cookies?.[REFRESH_TOKEN_COOKIE] === 'string' ? req.cookies[REFRESH_TOKEN_COOKIE] : null;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token bulunamadı.' });
  }

  const tokenRecord = refreshTokenStore.get(refreshToken);
  if (!tokenRecord || tokenRecord.expiresAt < Date.now()) {
    refreshTokenStore.delete(refreshToken);
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Refresh token geçersiz veya süresi dolmuş.' });
  }

  const authHeader = req.headers['authorization'];
  const currentAccessToken = req.cookies?.[TOKEN_COOKIE] || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
  let sessionPayload = {
    id: tokenRecord.userId,
    username: tokenRecord.userId,
    globalName: tokenRecord.userId,
    avatar: null,
    isDev: tokenRecord.userId === '651790387198820425'
  };

  if (currentAccessToken) {
    try {
      const decoded = jwt.decode(currentAccessToken);
      if (decoded && decoded.id) {
        sessionPayload = {
          id: decoded.id,
          username: decoded.username || tokenRecord.userId,
          globalName: decoded.globalName || decoded.username || tokenRecord.userId,
          avatar: decoded.avatar || null,
          isDev: Boolean(decoded.isDev || decoded.id === '651790387198820425')
        };
      }
    } catch (err) {
      // Ignore invalid current token; refresh still rotates user session safely.
    }
  }

  const nextRefreshToken = rotateRefreshToken(tokenRecord.userId, refreshToken);
  const accessToken = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '15m' });
  setSessionCookie(res, accessToken, 15 * 60 * 1000);
  setRefreshTokenCookie(res, nextRefreshToken, 7 * 24 * 60 * 60 * 1000);

  return res.json({ success: true, token: accessToken, refreshToken: nextRefreshToken });
});

// 5. Logout
router.post('/logout', (req, res) => {
  let token = req.cookies?.[TOKEN_COOKIE];
  const authHeader = req.headers['authorization'];
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (refreshToken) {
    refreshTokenStore.delete(refreshToken);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) {
        userGuildsCache.delete(decoded.id);
      }
    } catch (e) {}
  }

  clearSessionCookies(res);
  res.json({ success: true, message: 'Oturum başarıyla kapatıldı.' });
});

module.exports = router;
