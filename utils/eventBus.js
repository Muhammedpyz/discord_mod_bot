const EventEmitter = require('events');
const Redis = require('ioredis');

class RealtimeEventBus extends EventEmitter {
    constructor() {
        super();
        this.channelName = process.env.EVENT_BUS_CHANNEL || 'nyx_dev_realtime_events';
        this.isRedisConnected = false;

        const redisOptions = {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            retryStrategy(times) {
                return Math.min(times * 100, 3000);
            },
            lazyConnect: true
        };

        this.pubClient = new Redis(redisOptions);
        this.subClient = new Redis(redisOptions);

        this.pubClient.on('error', (err) => {
            // Silent error handler to prevent crashing if redis is offline
        });
        this.subClient.on('error', (err) => {
            // Silent error handler
        });

        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.pubClient.connect().catch(() => {}),
                this.subClient.connect().catch(() => {})
            ]);

            await this.subClient.subscribe(this.channelName).catch(() => {});
            this.isRedisConnected = true;

            this.subClient.on('message', (channel, message) => {
                if (channel !== this.channelName) return;
                try {
                    const parsed = JSON.parse(message);
                    // Emit both generic and specific events
                    this.emit('event', parsed);
                    if (parsed.type) {
                        this.emit(parsed.type, parsed.data);
                    }
                } catch (e) {
                    console.error('[EventBus] JSON parse error:', e.message);
                }
            });
        } catch (err) {
            console.warn('[EventBus] Redis Pub/Sub could not be initialized, falling back to local events:', err.message);
        }
    }

    broadcast(type, data = {}) {
        const payload = {
            type,
            data,
            timestamp: Date.now()
        };

        // Emit locally in current process
        this.emit('event', payload);
        this.emit(type, data);

        // Publish to Redis if connected
        if (this.pubClient && (this.pubClient.status === 'ready' || this.isRedisConnected)) {
            this.pubClient.publish(this.channelName, JSON.stringify(payload)).catch(() => {});
        }
    }

    emitEvent(type, data = {}) {
        this.broadcast(type, data);
    }
}

const eventBus = new RealtimeEventBus();

function broadcastEvent(type, data = {}) {
    eventBus.broadcast(type, data);
}

function emitEvent(type, data = {}) {
    eventBus.broadcast(type, data);
}

function onEvent(callback) {
    eventBus.on('event', callback);
    return () => eventBus.off('event', callback);
}

eventBus.eventBus = eventBus;
eventBus.broadcastEvent = broadcastEvent;
eventBus.emitEvent = emitEvent;
eventBus.onEvent = onEvent;

module.exports = eventBus;
module.exports.eventBus = eventBus;
module.exports.broadcastEvent = broadcastEvent;
module.exports.emitEvent = emitEvent;
module.exports.onEvent = onEvent;

