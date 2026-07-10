import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SavingJenis, SavingStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentMethod,
  SavingsType,
} from '../web3/abis/escrow.abi';
import { ContractClientService } from '../web3/contract-client.service';
import { HashingService } from '../web3/hashing.service';
import { CreateSavingDto } from './dto/create-saving.dto';
import { SavingsService } from './savings.service';
import { AuditLogService } from '../audit/audit.service';

const EXPLORER_BASE_URL = 'https://sepolia.basescan.org';
const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

describe('SavingsService', () => {
  let service: SavingsService;
  let prisma: {
    member: { findUnique: jest.Mock; update: jest.Mock };
    savingTransaction: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let hashing: { memberHash: jest.Mock };
  let contract: { trySubmit: jest.Mock };
  let audit: { append: jest.Mock };
  let config: { get: jest.Mock };

  const member = {
    id: MEMBER_ID,
    nik: '3273010000000001',
    nama: 'Ibu Sari',
    simpananPokok: 100000,
    simpananWajib: 50000,
    simpananSukarela: 25000,
  };

  /** A freshly-created saving row (no txHash yet), echoing the create input. */
  const savingRow = (over: Record<string, any> = {}) => ({
    id: 's-1',
    memberId: MEMBER_ID,
    jenis: SavingJenis.Wajib,
    nominal: 75000,
    tanggal: new Date('2026-07-11T10:00:00.000Z'),
    metode: 'QRIS',
    status: SavingStatus.PAID,
    txHash: null,
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      member: {
        findUnique: jest.fn().mockResolvedValue(member),
        update: jest.fn().mockResolvedValue(member),
      },
      savingTransaction: {
        create: jest.fn().mockResolvedValue(savingRow()),
        update: jest.fn().mockResolvedValue(savingRow({ txHash: '0xdead' })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    hashing = { memberHash: jest.fn().mockReturnValue('0xmemberhash') };
    contract = {
      trySubmit: jest.fn().mockResolvedValue({ ok: true, txHash: '0xdead' }),
    };
    audit = { append: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(EXPLORER_BASE_URL) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SavingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: HashingService, useValue: hashing },
        { provide: ContractClientService, useValue: contract },
        { provide: AuditLogService, useValue: audit },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(SavingsService);
  });

  const dto = (over: Partial<CreateSavingDto> = {}): CreateSavingDto => ({
    memberId: MEMBER_ID,
    jenis: SavingJenis.Wajib,
    nominal: 75000,
    metode: 'QRIS',
    ...over,
  });

  // --- Positive ---
  it('creates a PAID row with metode QRIS', async () => {
    await service.create(dto());

    expect(prisma.savingTransaction.create).toHaveBeenCalledWith({
      data: {
        memberId: MEMBER_ID,
        jenis: SavingJenis.Wajib,
        nominal: 75000,
        metode: 'QRIS',
        status: SavingStatus.PAID,
      },
    });
  });

  it('increments simpananWajib by nominal when paying Wajib', async () => {
    await service.create(dto());

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: MEMBER_ID },
      data: { simpananWajib: { increment: 75000 } },
    });
  });

  it('calls recordSavings with [hash, SavingsType.WAJIB, BigInt(nominal), PaymentMethod.QRIS]', async () => {
    await service.create(dto());

    expect(contract.trySubmit).toHaveBeenCalledWith('recordSavings', [
      '0xmemberhash',
      SavingsType.WAJIB,
      BigInt(75000),
      PaymentMethod.QRIS,
    ]);
    expect(hashing.memberHash).toHaveBeenCalledWith(member.nik);
  });

  it('persists the returned txHash on the saving row and returns it in the DTO', async () => {
    const result = await service.create(dto());

    expect(prisma.savingTransaction.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: { txHash: '0xdead' },
    });
    expect(result.txHash).toBe('0xdead');
    expect(result.txLink).toBe(`${EXPLORER_BASE_URL}/tx/0xdead`);
  });

  it('appends an audit entry with the member name, action, and detail', async () => {
    await service.create(dto());

    expect(audit.append).toHaveBeenCalledWith(
      member.nama,
      'SIMPANAN_PAID',
      expect.stringContaining('75000'),
      '0xdead',
    );
    const detail = audit.append.mock.calls[0][2];
    expect(detail).toContain(SavingJenis.Wajib);
  });

  it('findByMember returns rows newest-first (delegates ordering to Prisma)', async () => {
    prisma.savingTransaction.findMany.mockResolvedValue([
      savingRow({ id: 's-2', txHash: '0xbeef' }),
      savingRow({ id: 's-1', txHash: null }),
    ]);

    const result = await service.findByMember(MEMBER_ID);

    expect(prisma.savingTransaction.findMany).toHaveBeenCalledWith({
      where: { memberId: MEMBER_ID },
      orderBy: { tanggal: 'desc' },
    });
    expect(result.map((r) => r.id)).toEqual(['s-2', 's-1']);
  });

  it('findByMember derives txLink when txHash present and null otherwise', async () => {
    prisma.savingTransaction.findMany.mockResolvedValue([
      savingRow({ id: 's-2', txHash: '0xbeef' }),
      savingRow({ id: 's-1', txHash: null }),
    ]);

    const [withHash, withoutHash] = await service.findByMember(MEMBER_ID);

    expect(withHash.txLink).toBe(`${EXPLORER_BASE_URL}/tx/0xbeef`);
    expect(withoutHash.txHash).toBeNull();
    expect(withoutHash.txLink).toBeNull();
  });

  it('findByMember on empty data returns []', async () => {
    prisma.savingTransaction.findMany.mockResolvedValue([]);
    await expect(service.findByMember(MEMBER_ID)).resolves.toEqual([]);
  });

  // --- Graceful on-chain degradation ---
  it('on-chain trySubmit {ok:false} → row still PAID, balance still incremented, txHash null', async () => {
    contract.trySubmit.mockResolvedValue({ ok: false, error: 'no signer' });

    const result = await service.create(dto());

    // off-chain state persisted regardless
    expect(prisma.savingTransaction.create).toHaveBeenCalledTimes(1);
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: MEMBER_ID },
      data: { simpananWajib: { increment: 75000 } },
    });
    // no txHash persisted, none surfaced
    expect(prisma.savingTransaction.update).not.toHaveBeenCalled();
    expect(result.status).toBe(SavingStatus.PAID);
    expect(result.txHash).toBeNull();
    expect(result.txLink).toBeNull();
    // audit still appended, with undefined txHash
    expect(audit.append).toHaveBeenCalledWith(
      member.nama,
      'SIMPANAN_PAID',
      expect.any(String),
      undefined,
    );
  });

  it('on-chain ok:true but missing txHash does not persist a txHash', async () => {
    contract.trySubmit.mockResolvedValue({ ok: true });

    const result = await service.create(dto());

    expect(prisma.savingTransaction.update).not.toHaveBeenCalled();
    expect(result.txHash).toBeNull();
  });

  // --- Not found ---
  it('unknown memberId → NotFoundException and no saving created', async () => {
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(service.create(dto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.savingTransaction.create).not.toHaveBeenCalled();
    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(contract.trySubmit).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  // --- jenis → balance column + on-chain enum mapping ---
  const cases: Array<[SavingJenis, string, SavingsType]> = [
    [SavingJenis.Pokok, 'simpananPokok', SavingsType.POKOK],
    [SavingJenis.Wajib, 'simpananWajib', SavingsType.WAJIB],
    [SavingJenis.Sukarela, 'simpananSukarela', SavingsType.SUKARELA],
  ];
  it.each(cases)(
    'jenis %s → increments %s and submits SavingsType %s',
    async (jenis, column, savingsType) => {
      await service.create(dto({ jenis }));

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: MEMBER_ID },
        data: { [column]: { increment: 75000 } },
      });
      expect(contract.trySubmit).toHaveBeenCalledWith('recordSavings', [
        '0xmemberhash',
        savingsType,
        BigInt(75000),
        PaymentMethod.QRIS,
      ]);
    },
  );

  // --- DTO validation ---
  describe('CreateSavingDto validation', () => {
    it('accepts a valid payload', async () => {
      const instance = plainToInstance(CreateSavingDto, {
        memberId: MEMBER_ID,
        jenis: SavingJenis.Wajib,
        nominal: 75000,
      });
      expect(await validate(instance)).toHaveLength(0);
    });

    it('rejects an invalid jenis', async () => {
      const instance = plainToInstance(CreateSavingDto, {
        memberId: MEMBER_ID,
        jenis: 'Emas',
        nominal: 75000,
      });
      const errors = await validate(instance);
      expect(errors.some((e) => e.property === 'jenis')).toBe(true);
    });

    it('rejects a non-positive nominal', async () => {
      const instance = plainToInstance(CreateSavingDto, {
        memberId: MEMBER_ID,
        jenis: SavingJenis.Wajib,
        nominal: 0,
      });
      const errors = await validate(instance);
      expect(errors.some((e) => e.property === 'nominal')).toBe(true);
    });

    it('rejects a non-uuid memberId', async () => {
      const instance = plainToInstance(CreateSavingDto, {
        memberId: 'not-a-uuid',
        jenis: SavingJenis.Wajib,
        nominal: 75000,
      });
      const errors = await validate(instance);
      expect(errors.some((e) => e.property === 'memberId')).toBe(true);
    });
  });
});
