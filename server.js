require('dotenv').config({ path: __dirname + '/.env' });
BigInt.prototype.toJSON = function() { return this.toString(); };

const { ProxyAgent, setGlobalDispatcher } = require('undici');
const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
if (proxyUrl && process.env.ALLOW_HTTP_PROXY === 'true') {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch (e) {
    console.warn('Proxy dispatcher warning:', e.message);
  }
}

const dns = require('node:dns');
try {
  dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, getUserGuilds } = require('./backend/middleware/auth');
const { isSafeRedirectUri, sanitizeString, verifyDiscordInteractionSignature } = require('./backend/security');

const authRouter = require('./backend/routes/auth');
const guildsRouter = require('./backend/routes/guilds');
const statsRouter = require('./backend/routes/stats');
const proxyRouter = require('./backend/routes/proxy');

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://nyxbot.app',
  'https://www.nyxbot.app'
];

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.' }
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Giriş işlemi için çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.' }
});

const proxyRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Görsel proxy istek limiti aşıldı. Lütfen bir dakika bekleyin.' }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com', 'https://media.discordapp.net'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https://discord.com', 'https://cdn.discordapp.com'],
      fontSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginResourcePolicy: false,
  hidePoweredBy: true,
  noSniff: true,
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' }
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-signature-ed25519', 'x-signature-timestamp']
}));

app.post('/api/discord-interactions', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(500).json({ error: 'DISCORD_PUBLIC_KEY is not configured.' });
  }

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Invalid request signature' });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const isValid = verifyDiscordInteractionSignature({
    body: rawBody.toString('utf8'),
    signature,
    timestamp,
    publicKey
  });

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid request signature' });
  }

  try {
    const payload = JSON.parse(rawBody.toString('utf8'));
    return res.status(200).json({ ok: true, type: payload.type || null });
  } catch (err) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.use('/api/', apiRateLimiter);
app.use('/api/auth', authRateLimiter);
app.use('/api/proxy', proxyRateLimiter);

// Request logging
app.use((req, res, next) => {
  const sanitizedPath = sanitizeString(req.path, { maxLength: 120 });
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${sanitizedPath}`);
  next();
});

app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && !isSafeRedirectUri(value, ['localhost', '127.0.0.1', 'nyxbot.app']) && key.toLowerCase().includes('redirect')) {
      return res.status(400).json({ error: 'Geçersiz yönlendirme hedefi.' });
    }
  }

  next();
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/guilds', guildsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/proxy', proxyRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Helper: Extract and verify user session from request
function getAuthenticatedUser(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Helper: Verify if user has permission to view ticket
async function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (user.isDev || user.id === '651790387198820425') return true;
  if (String(ticket.owner_id) === String(user.id)) return true;

  try {
    const guilds = await getUserGuilds(user.id);
    const targetGuild = guilds.find(g => String(g.id) === String(ticket.guild_id));
    if (targetGuild) {
      const perms = BigInt(targetGuild.permissions || 0);
      const isAdmin = (perms & 0x8n) === 0x8n;
      const isManager = (perms & 0x20n) === 0x20n;
      if (isAdmin || isManager || targetGuild.owner) return true;
    }
  } catch (e) {}

  return false;
}

// Real-time Server-Sent Events (SSE) Stream
const { onEvent } = require('./utils/eventBus');

app.get('/api/events/live', (req, res) => {
  const { guildId, ticketId } = req.query;
  const user = getAuthenticatedUser(req);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Initial connection ping
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`);

  // Periodic keep-alive ping to prevent proxy/browser timeout
  const heartbeat = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 20000);

  const unsubscribe = onEvent(async (event) => {
    try {
      const data = event.data || {};

      // Filter by guildId if client provided one
      if (guildId && data.guild_id && String(data.guild_id) !== String(guildId)) {
        return;
      }
      // Filter by ticketId if client provided one
      if (ticketId) {
        const isMatch = (data.ticket_id && String(data.ticket_id) === String(ticketId)) ||
                        (data.channel_id && String(data.channel_id) === String(ticketId));
        if (!isMatch && event.type && event.type.startsWith('ticket_')) {
          return;
        }
      }

      // Security Check: Sensitive Moderation & Audit events require authenticated user with guild access
      const SENSITIVE_EVENT_TYPES = ['audit_log', 'sorgu_update', 'ticket_closed', 'penalty_revoke', 'config_update'];
      if (SENSITIVE_EVENT_TYPES.includes(event.type)) {
        if (!user) return; // Anonymous clients cannot see moderation events
        if (data.guild_id) {
          const guilds = await getUserGuilds(user.id);
          const hasAccess = guilds.some(g => String(g.id) === String(data.guild_id));
          if (!hasAccess && !user.isDev) return;
        }
      }

      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('[SSE] Broadcast error:', err.message);
    }
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Secure 1:1 Discord HTML Transcript Viewer
app.get('/api/transcripts/:ticketId/html', async (req, res) => {
  const { ticketId } = req.params;
  const user = getAuthenticatedUser(req);

  if (!user) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Oturum Gerekli — Nyx</title></head>
<body style="background:#111214;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="background:#2b2d31;padding:36px;border-radius:16px;text-align:center;max-width:440px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
    <h2 style="color:#f23f43;margin-top:0;">Oturum Açılması Gerekli</h2>
    <p style="color:#dbdee1;line-height:1.6;">Bu bilet transkriptini görüntüleyebilmek için lütfen web panelinde oturum açınız.</p>
    <a href="/dashboard" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#5865f2;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Panelle Giriş Yap</a>
  </div>
</body>
</html>`);
  }

  try {
    const { pool } = require('./db');
    const { generateDiscordTranscriptHtml } = require('./utils/discordHtmlExporter');
    const ticketRows = await pool.query('SELECT * FROM tickets WHERE id = ? OR channel_id = ? LIMIT 1', [ticketId, ticketId]);
    if (!ticketRows || ticketRows.length === 0) {
      return res.status(404).send('<!DOCTYPE html><html><body style="background:#313338;color:#fff;font-family:sans-serif;padding:40px;text-align:center;"><h2>Transkript Kaydı Bulunamadı</h2><p style="color:#949BA4;">Bilet silinmiş veya geçerli olmayan bir ID girilmiş.</p></body></html>');
    }
    const ticket = ticketRows[0];

    const hasAccess = await canAccessTicket(user, ticket);
    if (!hasAccess) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(403).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Yetkisiz Erişim — Nyx</title></head>
<body style="background:#111214;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="background:#2b2d31;padding:36px;border-radius:16px;text-align:center;max-width:440px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
    <h2 style="color:#f23f43;margin-top:0;">Yetkisiz Erişim</h2>
    <p style="color:#dbdee1;line-height:1.6;">Bu bilet kaydını yalnızca bileti açan üye veya sunucu yetkilileri görüntüleyebilir.</p>
  </div>
</body>
</html>`);
    }

    if (ticket.transcript_html && ticket.transcript_html.trim()) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(ticket.transcript_html);
    }
    const messages = await pool.query(`
      SELECT 
        id, message_id, author_id, author_tag, author_avatar, 
        content, attachments, attachments_json, embeds_json, 
        components_json, is_pinned, is_edited, created_at 
      FROM ticket_messages 
      WHERE channel_id = ? 
      ORDER BY created_at ASC
    `, [ticket.channel_id]);

    const html = await generateDiscordTranscriptHtml({
      channel: { name: `ticket-${ticket.id}` },
      messages: messages || [],
      ticketData: ticket
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('HTML transcript generation error:', err);
    res.status(500).send('<!DOCTYPE html><html><body style="background:#313338;color:#fff;font-family:sans-serif;padding:40px;text-align:center;"><h2>Transkript Hatası</h2><p>' + err.message + '</p></body></html>');
  }
});

// Secure Transcript JSON Endpoint
app.get('/api/transcripts/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
  }

  try {
    const { pool } = require('./db');
    const ticketRows = await pool.query('SELECT * FROM tickets WHERE id = ? OR channel_id = ? LIMIT 1', [ticketId, ticketId]);
    if (!ticketRows || ticketRows.length === 0) {
      return res.status(404).json({ error: 'Transkript kaydı bulunamadı veya silinmiş.' });
    }
    const ticket = ticketRows[0];

    const hasAccess = await canAccessTicket(user, ticket);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Bu bilet kaydını görüntüleme yetkiniz yok.' });
    }

    const messages = await pool.query(`
      SELECT 
        id, message_id, author_id, author_tag, author_avatar, 
        content, attachments, attachments_json, embeds_json, 
        components_json, is_pinned, is_edited, created_at 
      FROM ticket_messages 
      WHERE channel_id = ? 
      ORDER BY created_at ASC
    `, [ticket.channel_id]);

    res.json({ 
      ticket, 
      messages,
      html_url: `/api/transcripts/${ticket.id}/html`
    });
  } catch (err) {
    console.error('Public transcript fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Server Unhandled Error:', err);
  res.status(500).json({ error: 'Sunucu içi bir hata oluştu.', details: err.message });
});

// --- PIXEL-PIXEL FRONTEND LOGGING SYSTEM ---
app.post('/api/logs/frontend', (req, res) => {
  const { event, details, url, userAgent, timestamp } = req.body;
  
  const fs = require('fs');
  const path = require('path');
  const logMsg = `[FRONTEND] ${new Date(timestamp || Date.now()).toISOString()} | Event: ${event} | URL: ${url} | Details: ${JSON.stringify(details)}\n`;
  
  fs.appendFile(path.join(__dirname, '../bot.log'), logMsg, (err) => {
    if (err) console.error('Frontend Log Error:', err);
  });
  
  res.json({ success: true });
});

// START SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`  -> Auth Routes: http://localhost:${PORT}/api/auth`);
  console.log(`  -> Guilds Routes: http://localhost:${PORT}/api/guilds`);
  console.log(`  -> Stats Route: http://localhost:${PORT}/api/stats`);
  // Event-driven cache invalidation (webhook mantığı: değişim olunca yenile)
  try {
    require('./utils/cacheInvalidate').setupInvalidation();
  } catch (e) {
    console.error('[CacheInvalidate] başlatılamadı:', e.message);
  }
});
