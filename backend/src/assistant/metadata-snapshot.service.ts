import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

/** A count keyed by an enum/string value (e.g. { Approved: 12, Requested: 3 }). */
export type CountByKey = Record<string, number>;

export interface SnapshotAggregates {
  members: {
    total: number;
    byStatusKyc: CountByKey;
    byPeran: CountByKey;
    byRole: CountByKey;
  };
  loans: {
    total: number;
    byFlagAi: CountByKey;
    byStatus: CountByKey;
    byStatusCicilan: CountByKey;
  };
  savings: {
    totalPokok: number;
    totalWajib: number;
    totalSukarela: number;
    total: number;
  };
  groups: {
    totalKasSosial: number;
  };
  rentengEvents: {
    total: number;
  };
  audit: {
    total: number;
  };
}

export interface Snapshot {
  generatedAt: string;
  schema: string;
  aggregates: SnapshotAggregates;
}

const CACHE_KEY = 'rr:metadata:snapshot';
const DEFAULT_REFRESH_MS = 60000;

/** Short, human-readable description of the tables the assistant may reason over. */
const SCHEMA_DESCRIPTION = [
  'Database schema (PostgreSQL, snake_case tables):',
  '- members(id, nama, nik, peran[penabung|peminjam|keduanya], status_kyc[Requested|Approved|Rejected], role[Anggota|Pengurus], skor_keanggotaan, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur)',
  '- groups(id, nama, ketua_id, plafon_maks, kehadiran_rate, kas_sosial, reputasi_komunitas)',
  '- member_groups(member_id, group_id, joined_at)',
  '- loans(id, member_id, group_id, nominal, tujuan, tenor, status[Diajukan|Disetujui|Cair|Lunas|Mangkir|Ditunda], status_cicilan[PAID|UNPAID|TUNGGAKAN|DITALANGI], skor_ai, flag_ai[HIJAU|KUNING|MERAH])',
  '- saving_transactions(id, member_id, jenis[Pokok|Wajib|Sukarela], nominal, tanggal, status[PAID|PENDING])',
  '- renteng_events(id, member_id, loan_id, event, amount, period)',
  '- audit_logs(id, timestamp, aktor, aksi, detail)',
].join('\n');

/** Convert a Prisma Decimal | number | null | undefined to a plain number. */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Fold Prisma groupBy rows ([{ key, _count: { _all } }]) into a CountByKey. */
function foldGroupBy<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
): CountByKey {
  const out: CountByKey = {};
  for (const row of rows) {
    const k = String(row[key]);
    out[k] = toNumber(row?._count?._all ?? row?._count);
  }
  return out;
}

/**
 * Maintains a cached snapshot of DB metadata + live aggregates that grounds the
 * assistant. The snapshot is cached (Redis or memory) with a TTL, rebuilt on
 * miss, and proactively refreshed on an interval so answers stay current without
 * recomputing on every request.
 */
@Injectable()
export class MetadataSnapshotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetadataSnapshotService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private refreshMs(): number {
    const raw = Number(this.config.get<string>('METADATA_REFRESH_MS'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REFRESH_MS;
  }

  onModuleInit(): void {
    const intervalMs = this.refreshMs();
    // Proactively keep the cache warm; setInterval (not @nestjs/schedule).
    this.timer = setInterval(() => {
      this.refresh().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`snapshot_refresh_failed: ${message}`);
      });
    }, intervalMs);
    // Do not keep the event loop alive solely for the refresh timer.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Return the cached snapshot, rebuilding (and caching) it on a miss. */
  async getSnapshot(): Promise<Snapshot> {
    const cached = await this.cache.get<Snapshot>(CACHE_KEY);
    if (cached) return cached;
    return this.refresh();
  }

  /** Rebuild the snapshot from live data and write it to the cache. */
  private async refresh(): Promise<Snapshot> {
    const snapshot = await this.buildSnapshot();
    const ttlSeconds = Math.max(1, Math.floor(this.refreshMs() / 1000));
    await this.cache.set(CACHE_KEY, snapshot, ttlSeconds);
    return snapshot;
  }

  /** Compute the snapshot: static schema text + live Prisma aggregates. */
  async buildSnapshot(): Promise<Snapshot> {
    const [
      membersTotal,
      membersByStatusKyc,
      membersByPeran,
      membersByRole,
      loansTotal,
      loansByFlagAi,
      loansByStatus,
      loansByStatusCicilan,
      savingsSums,
      groupsSums,
      rentengTotal,
      auditTotal,
    ] = await this.prisma.$transaction([
      this.prisma.member.count(),
      this.prisma.member.groupBy({
        by: ['statusKyc'],
        _count: { _all: true },
        orderBy: { statusKyc: 'asc' },
      }),
      this.prisma.member.groupBy({
        by: ['peran'],
        _count: { _all: true },
        orderBy: { peran: 'asc' },
      }),
      this.prisma.member.groupBy({
        by: ['role'],
        _count: { _all: true },
        orderBy: { role: 'asc' },
      }),
      this.prisma.loan.count(),
      this.prisma.loan.groupBy({
        by: ['flagAi'],
        _count: { _all: true },
        orderBy: { flagAi: 'asc' },
      }),
      this.prisma.loan.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.loan.groupBy({
        by: ['statusCicilan'],
        _count: { _all: true },
        orderBy: { statusCicilan: 'asc' },
      }),
      this.prisma.member.aggregate({
        _sum: {
          simpananPokok: true,
          simpananWajib: true,
          simpananSukarela: true,
        },
      }),
      this.prisma.group.aggregate({ _sum: { kasSosial: true } }),
      this.prisma.rentengEvent.count(),
      this.prisma.auditLog.count(),
    ]);

    const totalPokok = toNumber(savingsSums?._sum?.simpananPokok);
    const totalWajib = toNumber(savingsSums?._sum?.simpananWajib);
    const totalSukarela = toNumber(savingsSums?._sum?.simpananSukarela);

    return {
      generatedAt: new Date().toISOString(),
      schema: SCHEMA_DESCRIPTION,
      aggregates: {
        members: {
          total: toNumber(membersTotal),
          byStatusKyc: foldGroupBy(membersByStatusKyc as any[], 'statusKyc'),
          byPeran: foldGroupBy(membersByPeran as any[], 'peran'),
          byRole: foldGroupBy(membersByRole as any[], 'role'),
        },
        loans: {
          total: toNumber(loansTotal),
          byFlagAi: foldGroupBy(loansByFlagAi as any[], 'flagAi'),
          byStatus: foldGroupBy(loansByStatus as any[], 'status'),
          byStatusCicilan: foldGroupBy(
            loansByStatusCicilan as any[],
            'statusCicilan',
          ),
        },
        savings: {
          totalPokok,
          totalWajib,
          totalSukarela,
          total: totalPokok + totalWajib + totalSukarela,
        },
        groups: {
          totalKasSosial: toNumber(groupsSums?._sum?.kasSosial),
        },
        rentengEvents: { total: toNumber(rentengTotal) },
        audit: { total: toNumber(auditTotal) },
      },
    };
  }
}
