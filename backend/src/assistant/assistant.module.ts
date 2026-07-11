import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { MetadataSnapshotService } from './metadata-snapshot.service';

/**
 * Pengurus admin assistant: a Gemini chatbot grounded on a periodically
 * refreshed metadata/aggregate snapshot, cached via the Redis-optional
 * CacheService.
 */
@Module({
  imports: [CacheModule],
  controllers: [AssistantController],
  providers: [MetadataSnapshotService, AssistantService],
  exports: [AssistantService, MetadataSnapshotService],
})
export class AssistantModule {}
