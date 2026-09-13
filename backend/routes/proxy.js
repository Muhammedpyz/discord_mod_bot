const express = require('express');
const router = express.Router();

// Memory cache for fetched images (URL -> { buffer, contentType, timestamp })
const imageCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

router.get('/discord-image', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const parsed = new URL(targetUrl);
    // Security check: Only allow HTTPS on Discord CDN domains
    if (parsed.protocol !== 'https:') {
      return res.status(403).send('Forbidden: Only HTTPS is permitted');
    }

    const allowedHosts = ['cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net', 'images-ext-2.discordapp.net'];
    if (!allowedHosts.includes(parsed.hostname)) {
      return res.status(403).send('Forbidden: Only Discord CDN hosts are permitted');
    }

    // Check memory cache
    const cached = imageCache.get(targetUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(cached.buffer);
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(400).send('Forbidden: Target content is not an image');
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > 10 * 1024 * 1024) {
      return res.status(413).send('Image too large: maximum allowed size is 10MB');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store in cache (limit cache size to prevent memory leaks)
    if (imageCache.size > 200) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
    imageCache.set(targetUrl, { buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.send(buffer);
  } catch (err) {
    console.error('Discord image proxy error:', err.message);
    return res.status(500).send('Proxy error: ' + err.message);
  }
});

module.exports = router;
