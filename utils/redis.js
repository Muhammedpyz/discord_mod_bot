const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
    maxRetriesPerRequest: null
});

redis.on('error', (err) => {
    // Silent connect error log to prevent console flood if redis restarts
});

redis.on('connect', () => {
    console.log('[Redis] Önbellek sunucusuna başarıyla bağlandı.');
});

/**
 * Gets a cached JSON object by key.
 */
async function getCache(key) {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Sets a cached JSON object with expiration in seconds.
 */
async function setCache(key, value, ttlSeconds = 30) {
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {}
}

/**
 * Deletes a cached key.
 */
async function delCache(key) {
    try {
        await redis.del(key);
    } catch (e) {}
}

module.exports = { redis, getCache, setCache, delCache };
