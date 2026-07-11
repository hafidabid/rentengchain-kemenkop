import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { MetadataSnapshotService } from './metadata-snapshot.service';

/** Config stub: no Redis, a long refresh window so the cache never expires. */
const makeConfig = (): ConfigService =>
  ({
    get: jest.fn((key: string) =>
      key === 'METADATA_REFRESH_MS' ? '600000' : undefined,
    ),
  }) as unknown as ConfigService;

/** A Prisma mock whose groupBy returns rows keyed by the requested field. */
function makePrisma() {
  const memberGroupBy = jest.fn(({ by }: { by: string[] }) => {
    const field = by[0];
    if (field === 'statusKyc') {
      return Promise.resolve([
        { statusKyc: 'Approved', _count: { _all: 2 } },
        { statusKyc: 'Requested', _count: { _all: 1 } },
      ]);
    }
    if (field === 'peran') {
      return Promise.resolve([{ peran: 'penabung', _count: { _all: 3 } }]);
    }
    return Promise.resolve([{ role: 'Anggota', _count: { _all: 3 } }]);
  });
  const loanGroupBy = jest.fn(({ by }: { by: string[] }) => {
    const field = by[0];
    if (field === 'flagAi') {
      return Promise.resolve([{ flagAi: 'HIJAU', _count: { _all: 4 } }]);
    }
    if (field === 'status') {
      return Promise.resolve([{ status: 'Cair', _count: { _all: 4 } }]);
    }
    return Promise.resolve([{ statusCicilan: 'PAID', _count: { _all: 4 } }]);
  });

  const prisma = {
    member: {
      count: jest.fn().mockResolvedValue(3),
      groupBy: memberGroupBy,
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          simpananPokok: 1000,
          simpananWajib: 500,
          simpananSukarela: 250,
        },
      }),
    },
    loan: {
      count: jest.fn().mockResolvedValue(4),
      groupBy: loanGroupBy,
    },
    group: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { kasSosial: 750 } }),
    },
    rentengEvent: { count: jest.fn().mockResolvedValue(2) },
    auditLog: { count: jest.fn().mockResolvedValue(9) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return prisma;
}

describe('MetadataSnapshotService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let cache: CacheService;
  let service: MetadataSnapshotService;

  beforeEach(() => {
    prisma = makePrisma();
    // Real in-memory CacheService (Redis-absent path).
    cache = new CacheService(makeConfig());
    service = new MetadataSnapshotService(
      prisma as unknown as PrismaService,
      cache,
      makeConfig(),
    );
  });

  it('uses the in-memory cache backend when Redis is absent', () => {
    expect(cache.backend).toBe('memory');
  });

  it('computes aggregates from Prisma with Decimals as numbers', async () => {
    const snapshot = await service.getSnapshot();

    expect(typeof snapshot.generatedAt).toBe('string');
    expect(snapshot.schema).toContain('members');
    expect(snapshot.schema).toContain('loans');

    const a = snapshot.aggregates;
    expect(a.members.total).toBe(3);
    expect(a.members.byStatusKyc).toEqual({ Approved: 2, Requested: 1 });
    expect(a.members.byPeran).toEqual({ penabung: 3 });
    expect(a.members.byRole).toEqual({ Anggota: 3 });
    expect(a.loans.total).toBe(4);
    expect(a.loans.byFlagAi).toEqual({ HIJAU: 4 });
    expect(a.savings).toEqual({
      totalPokok: 1000,
      totalWajib: 500,
      totalSukarela: 250,
      total: 1750,
    });
    expect(a.groups.totalKasSosial).toBe(750);
    expect(a.rentengEvents.total).toBe(2);
    expect(a.audit.total).toBe(9);
  });

  it('reuses the cached snapshot across two calls within the interval', async () => {
    const first = await service.getSnapshot();
    const second = await service.getSnapshot();

    // Same cached object → identical generatedAt, and Prisma hit only once.
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.member.count).toHaveBeenCalledTimes(1);
  });
});
