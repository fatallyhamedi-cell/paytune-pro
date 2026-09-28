import Redis from 'ioredis';

/**
 * PAYTUNE High-Performance Caching Layer
 * - Multi-tier: Redis primary with seamless in-memory fallback
 * - Automatic TTL invalidation
 * - Zero crash on missing Redis connection
 */

interface CacheEntry {
  value: any;
  expiresAt: number;
}

class CacheService {
  private redisClient: Redis | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private isRedisAvailable = false;

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy: () => null // Don't hang indefinitely if offline
        });

        client.on('connect', () => {
          this.isRedisAvailable = true;
          this.redisClient = client;
          console.log('[CacheService] Connected to Redis caching server');
        });

        client.on('error', (err) => {
          this.isRedisAvailable = false;
          // Silent fallback to memory cache
        });
      } catch (err) {
        this.isRedisAvailable = false;
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        if (data) return JSON.parse(data) as T;
      } catch {
        // Fallback to memory
      }
    }

    // Memory cache fallback
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        return entry.value as T;
      }
      this.memoryCache.delete(key);
    }

    return null;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch {
        // Fall through to memory
      }
    }

    // Memory cache fallback
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch {
        // Continue
      }
    }
    this.memoryCache.delete(key);
  }

  async flush(): Promise<void> {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch {
        // Continue
      }
    }
    this.memoryCache.clear();
  }
}

export const cacheService = new CacheService();
export default cacheService;
