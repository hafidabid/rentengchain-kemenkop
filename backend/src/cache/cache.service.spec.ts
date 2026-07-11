import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

/** A ConfigService stub that never provides REDIS_URL → memory backend. */
const noRedisConfig = (): ConfigService =>
  ({ get: jest.fn().mockReturnValue(undefined) }) as unknown as ConfigService;

describe('CacheService (in-memory)', () => {
  it('reports the memory backend when REDIS_URL is absent', () => {
    const cache = new CacheService(noRedisConfig());
    expect(cache.backend).toBe('memory');
  });

  it('round-trips a value through set/get', async () => {
    const cache = new CacheService(noRedisConfig());
    const payload = { a: 1, b: ['x', 'y'], nested: { ok: true } };

    await cache.set('key', payload, 60);
    const result = await cache.get<typeof payload>('key');

    expect(result).toEqual(payload);
    // Serialized, not the same reference.
    expect(result).not.toBe(payload);
  });

  it('returns null for a missing key', async () => {
    const cache = new CacheService(noRedisConfig());
    expect(await cache.get('nope')).toBeNull();
  });

  it('returns null for an expired key', async () => {
    const cache = new CacheService(noRedisConfig());
    await cache.set('short', 123, 0.01); // ~10ms TTL
    await new Promise((r) => setTimeout(r, 25));
    expect(await cache.get('short')).toBeNull();
  });

  it('treats a non-positive TTL as immediately expired', async () => {
    const cache = new CacheService(noRedisConfig());
    await cache.set('zero', 'v', 0);
    expect(await cache.get('zero')).toBeNull();
  });
});
