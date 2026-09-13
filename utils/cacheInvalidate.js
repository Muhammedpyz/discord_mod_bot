/**
 * Event-driven cache invalidation (backend).
 * Site cache'i uzun TTL ile durur; SADECE bot'tan gelen veri-değişim
 * olaylarında ilgili key'ler silinir + siteye anlık `stats_invalidated`
 * push'lanır (SSE /api/events/live üzerinden).
 */
const { delCache } = require('./redis');
const { onEvent, broadcastEvent } = require('./eventBus');

const INVALIDATE_KEYS = ['web:stats', 'web:commands'];

const DATA_EVENTS = new Set([
    'moderation_action',
    'ticket_opened',
    'member_join',
    'member_leave',
    'guild_list_changed',
    'commands_changed'
]);

let initialized = false;

function setupInvalidation() {
    if (initialized) return;
    initialized = true;

    onEvent(async (event) => {
        try {
            if (!event || !DATA_EVENTS.has(event.type)) return;
            for (const k of INVALIDATE_KEYS) {
                await delCache(k);
            }
            // Siteye anlık push: açık sekmeler hemen yenilesin
            broadcastEvent('stats_invalidated', {
                reason: event.type,
                guild_id: event.data && event.data.guild_id ? String(event.data.guild_id) : null,
                at: Date.now()
            });
        } catch (e) {
            console.error('[CacheInvalidate]:', e.message);
        }
    });

    console.log('[CacheInvalidate] Event-driven invalidation aktif.');
}

module.exports = { setupInvalidation, INVALIDATE_KEYS, DATA_EVENTS };
