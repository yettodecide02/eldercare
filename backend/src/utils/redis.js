const logger = require('./logger');

// In-memory store for dev/test when Redis is not available
class InMemoryStore {
  constructor() { this.store = new Map(); this.timers = new Map(); }
  async get(key) { return this.store.has(key) ? String(this.store.get(key)) : null; }
  async set(key, value, ex, ttl) {
    this.store.set(key, value);
    if (ex === 'EX' && ttl) {
      clearTimeout(this.timers.get(key));
      this.timers.set(key, setTimeout(() => this.store.delete(key), ttl * 1000));
    }
    return 'OK';
  }
  async del(key) { this.store.delete(key); return 1; }
  async incr(key) {
    const v = parseInt(this.store.get(key) || '0') + 1;
    this.store.set(key, v);
    return v;
  }
  async expire(key, secs) {
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.store.delete(key), secs * 1000));
    return 1;
  }
  async ttl(key) { return this.store.has(key) ? 3600 : -2; }
}

let client = null;

const getRedis = () => {
  if (client) return client;

  if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
    client = new InMemoryStore();
    logger.info('Redis: using in-memory fallback (dev/test)');
    return client;
  }

  try {
    const Redis = require('ioredis');
    client = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: false,
    });
    client.on('error', (err) => logger.error('Redis error', { error: err.message }));
    client.on('connect', () => logger.info('Redis connected'));
  } catch {
    client = new InMemoryStore();
    logger.warn('Redis unavailable, using in-memory fallback');
  }

  return client;
};

module.exports = { getRedis };
