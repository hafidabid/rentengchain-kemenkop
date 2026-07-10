import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogDto, toAuditLogDto } from '../common/serializers';

/**
 * Append-only audit trail. Other flow modules inject this service to record
 * state-changing actions (KYC approval, savings, repayment, bailout, appeals).
 *
 * `txLink` is NEVER stored; it is derived at read time from `txHash` + the
 * configured explorer base URL.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private explorerBaseUrl(): string {
    return this.config.get<string>(
      'EXPLORER_BASE_URL',
      'https://sepolia.basescan.org',
    );
  }

  /** Persist a new immutable audit row with a server timestamp. */
  async append(
    aktor: string,
    aksi: string,
    detail: string,
    txHash?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { aktor, aksi, detail, txHash: txHash ?? null },
    });
  }

  /** Return audit entries newest-first, each mapped through toAuditLogDto. */
  async list(limit = 50, offset = 0): Promise<AuditLogDto[]> {
    const explorerBaseUrl = this.explorerBaseUrl();
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
    return logs.map((log) => toAuditLogDto(log, explorerBaseUrl));
  }
}
