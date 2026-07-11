import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/** Provides the Redis-optional CacheService for injection across modules. */
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
