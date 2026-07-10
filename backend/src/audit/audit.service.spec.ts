import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit.service';

const EXPLORER_BASE_URL = 'https://sepolia.basescan.org';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: {
    auditLog: { create: jest.Mock; findMany: jest.Mock };
  };
  let config: { get: jest.Mock };

  const withTxHash = {
    id: 'a-2',
    timestamp: new Date('2026-07-11T10:00:00.000Z'),
    aktor: 'm-1',
    aksi: 'KYC_APPROVED',
    detail: 'Approved member m-9',
    txHash: '0xabc123',
  };
  const withoutTxHash = {
    id: 'a-1',
    timestamp: new Date('2026-07-11T09:00:00.000Z'),
    aktor: 'system',
    aksi: 'SAVINGS_DEPOSIT',
    detail: 'Deposit 50000',
    txHash: null,
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn(),
      },
    };
    config = {
      get: jest.fn().mockReturnValue(EXPLORER_BASE_URL),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuditLogService);
  });

  // --- Positive ---
  it('append() persists a row with the provided fields and txHash', async () => {
    await service.append('m-1', 'KYC_APPROVED', 'Approved member m-9', '0xabc123');

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        aktor: 'm-1',
        aksi: 'KYC_APPROVED',
        detail: 'Approved member m-9',
        txHash: '0xabc123',
      },
    });
  });

  it('append() without a txHash stores null (never undefined)', async () => {
    await service.append('system', 'SAVINGS_DEPOSIT', 'Deposit 50000');

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        aktor: 'system',
        aksi: 'SAVINGS_DEPOSIT',
        detail: 'Deposit 50000',
        txHash: null,
      },
    });
  });

  it('list() returns entries newest-first (delegates ordering to Prisma)', async () => {
    prisma.auditLog.findMany.mockResolvedValue([withTxHash, withoutTxHash]);

    const result = await service.list();

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      orderBy: { timestamp: 'desc' },
      take: 50,
      skip: 0,
    });
    expect(result.map((e) => e.id)).toEqual(['a-2', 'a-1']);
    expect(result[0].timestamp.getTime()).toBeGreaterThan(
      result[1].timestamp.getTime(),
    );
  });

  it('list() derives txLink for an entry WITH a txHash', async () => {
    prisma.auditLog.findMany.mockResolvedValue([withTxHash]);

    const [entry] = await service.list();

    expect(entry.txHash).toBe('0xabc123');
    expect(entry.txLink).toBe(`${EXPLORER_BASE_URL}/tx/0xabc123`);
  });

  it('list() yields txLink null for an entry WITHOUT a txHash', async () => {
    prisma.auditLog.findMany.mockResolvedValue([withoutTxHash]);

    const [entry] = await service.list();

    expect(entry.txHash).toBeNull();
    expect(entry.txLink).toBeNull();
  });

  it('list() forwards custom limit/offset to Prisma take/skip', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(10, 20);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      orderBy: { timestamp: 'desc' },
      take: 10,
      skip: 20,
    });
  });

  // --- Edge cases ---
  it('list() on empty data returns []', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.list();

    expect(result).toEqual([]);
  });

  it('list() collapses a trailing slash in EXPLORER_BASE_URL to a single slash', async () => {
    config.get.mockReturnValue('https://sepolia.basescan.org/');
    prisma.auditLog.findMany.mockResolvedValue([withTxHash]);

    const [entry] = await service.list();

    expect(entry.txLink).toBe('https://sepolia.basescan.org/tx/0xabc123');
    expect(entry.txLink).not.toContain('//tx/');
  });

  it('reads EXPLORER_BASE_URL from config with the spec default fallback', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list();

    expect(config.get).toHaveBeenCalledWith(
      'EXPLORER_BASE_URL',
      'https://sepolia.basescan.org',
    );
  });
});
