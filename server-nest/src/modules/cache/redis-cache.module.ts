import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisInsStore } from 'cache-manager-ioredis-yet';
import { Redis } from 'ioredis';

/**
 * Redis-backed cache, wired through @nestjs/cache-manager + ioredis.
 * Connection string from REDIS_URL (ioredis parses redis:// / rediss:// URLs).
 * Marked @Global so any module can inject CACHE_MANAGER without re-importing.
 *
 * Usage:
 *   constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
 *   await this.cache.get(key) / set(key, val, ttl)
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redis = config.get('redis');
        const client = new Redis(redis.url, {
          // keep the app booting even if Redis is briefly unavailable
          lazyConnect: false,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
        return {
          store: redisInsStore(client, { ttl: redis.ttl }),
          ttl: redis.ttl,
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
