import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** In-memory entry: the JSON-serializable value plus an absolute expiry (ms). */
interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/**
 * Redis-optional key/value cache with a single interface. When `REDIS_URL` is
 * configured it uses ioredis (JSON-serialized values); otherwise, or whenever
 * Redis errors, it degrades to an in-memory Map with per-key expiry. A failing
 * cache must never crash the caller, so all Redis errors fall back to memory.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis: Redis | null = null;

  /** Which backend is actually in use after construction. */
  readonly backend: 'redis' | 'memory';

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (url) {
      try {
        // ioredis only connects on construction, so a top-level import is safe.
        this.redis = new Redis(url, {
          lazyConnect: false,
          maxRetriesPerRequest: 1,
        });
        this.redis.on('error', (err: Error) => {
          this.logger.warn(
            `redis_error: falling back to memory cache: ${err.message}`,
          );
          this.redis = null;
        });
        this.backend = 'redis';
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `redis_init_failed: falling back to memory cache: ${message}`,
        );
        this.redis = null;
      }
    }
    this.backend = 'memory';
  }

  onModuleInit(): void {
    /* no-op: connection is established eagerly in the constructor. */
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  /** Fetch a value; returns null on miss, expiry, or any cache error. */
  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null || raw === undefined) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`redis_get_failed: falling back to memory: ${message}`);
        this.redis = null;
      }
    }
    return this.getFromMemory<T>(key);
  }

  /** Store a value with a TTL (seconds). Silently degrades on Redis error. */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.redis) {
      try {
        const ttl = Math.max(1, Math.floor(ttlSeconds));
        await this.redis.set(key, serialized, 'EX', ttl);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`redis_set_failed: falling back to memory: ${message}`);
        this.redis = null;
      }
    }
    this.memory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }
}
