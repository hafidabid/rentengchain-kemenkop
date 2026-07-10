import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit.service';
import { AuditLogDto } from '../common/serializers';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;

/** Parse a query value into a bounded non-negative integer. */
function parseBounded(raw: unknown, fallback: number, max?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  const floored = Math.floor(n);
  return max !== undefined ? Math.min(floored, max) : floored;
}

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AuditLogDto[]> {
    const take = parseBounded(limit, DEFAULT_LIMIT, MAX_LIMIT);
    const skip = parseBounded(offset, DEFAULT_OFFSET);
    return this.auditLogService.list(take, skip);
  }
}
