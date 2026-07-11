import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MembersService } from './members.service';

describe('MembersService', () => {
  let service: MembersService;
  let prisma: {
    member: { findMany: jest.Mock; findUnique: jest.Mock };
    savingTransaction: { findMany: jest.Mock };
    loan: { findMany: jest.Mock };
    rentengEvent: { findMany: jest.Mock };
  };

  const anggota = {
    id: 'm-1',
    nik: '3273010000000001',
    nama: 'Ibu Sari',
    role: 'Anggota',
    peran: 'penabung',
    statusKyc: 'Approved',
    skorKeanggotaan: 80,
    walletAddress: null,
    simpananPokok: 100000,
    simpananWajib: 50000,
    simpananSukarela: 25000,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0,
    passwordHash: 'hashed-password',
    encryptedPrivkey: 'super-secret-key',
  };

  const pengurus = {
    ...anggota,
    id: 'm-2',
    nik: '3273010000000002',
    nama: 'Bendahara Koperasi',
    role: 'Pengurus',
    walletAddress: '0xabc',
  };

  beforeEach(async () => {
    prisma = {
      member: { findMany: jest.fn(), findUnique: jest.fn() },
      savingTransaction: { findMany: jest.fn() },
      loan: { findMany: jest.fn() },
      rentengEvent: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(MembersService);
  });

  // --- Positive ---
  it('findAll returns mapped members', async () => {
    prisma.member.findMany.mockResolvedValue([anggota, pengurus]);
    const result = await service.findAll();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('m-1');
    expect(result[1].id).toBe('m-2');
  });

  it('findAll never leaks secrets and keeps walletAddress (may be null)', async () => {
    prisma.member.findMany.mockResolvedValue([anggota, pengurus]);
    const [first, second] = await service.findAll();

    expect((first as any).passwordHash).toBeUndefined();
    expect((first as any).encryptedPrivkey).toBeUndefined();
    expect('walletAddress' in first).toBe(true);
    expect(first.walletAddress).toBeNull();
    expect(second.walletAddress).toBe('0xabc');
  });

  it('findAll converts Decimal savings to numbers', async () => {
    prisma.member.findMany.mockResolvedValue([anggota]);
    const [member] = await service.findAll();
    expect(member.simpananPokok).toBe(100000);
    expect(member.simpananWajib).toBe(50000);
    expect(member.simpananSukarela).toBe(25000);
  });

  it('findOne returns the sanitized member', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    const member = await service.findOne('m-1');
    expect(member.id).toBe('m-1');
    expect((member as any).passwordHash).toBeUndefined();
    expect((member as any).encryptedPrivkey).toBeUndefined();
  });

  // --- Edge cases ---
  it('findOne throws NotFoundException for an unknown id', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOneForUser lets a Pengurus read any member', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    const actor: AuthUser = { userId: 'm-2', role: Role.Pengurus };
    const member = await service.findOneForUser('m-1', actor);
    expect(member.id).toBe('m-1');
  });

  it('findOneForUser lets an Anggota read their own record', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    const actor: AuthUser = { userId: 'm-1', role: Role.Anggota };
    const member = await service.findOneForUser('m-1', actor);
    expect(member.id).toBe('m-1');
  });

  it('findOneForUser forbids an Anggota reading another member', async () => {
    const actor: AuthUser = { userId: 'm-1', role: Role.Anggota };
    await expect(
      service.findOneForUser('m-2', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  // --- detail ---
  const savingRow = {
    id: 's-1',
    memberId: 'm-1',
    jenis: 'Wajib',
    nominal: 50000,
    tanggal: new Date('2026-07-01T00:00:00.000Z'),
    metode: 'transfer',
    status: 'PAID',
    txHash: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const loanRow = {
    id: 'l-1',
    memberId: 'm-1',
    groupId: 'g-1',
    nominal: 1000000,
    tujuan: 'modal usaha',
    tenor: 10,
    status: 'Cair',
    statusCicilan: 'UNPAID',
    sisaCicilan: 8,
    cicilanBulanan: 100000,
    jadwalCicilan: 'Setiap Jumat',
    skorAi: 70,
    flagAi: 'HIJAU',
    flagAlasan: ['sehat'],
    isSanggah: false,
    sanggahAlasan: null,
    onchainLoanId: 7n,
    txHash: null,
    createdAt: new Date('2026-07-11T00:00:00.000Z'),
    updatedAt: new Date('2026-07-11T00:00:00.000Z'),
  };

  const rentengOld = {
    id: 're-1',
    memberId: 'm-1',
    loanId: 'l-1',
    event: 'Ditalangi',
    amount: 100000,
    period: 1,
    txHash: '0xabc',
    createdAt: new Date('2026-07-05T00:00:00.000Z'),
  };
  const rentengNew = {
    id: 're-2',
    memberId: 'm-1',
    loanId: 'l-1',
    event: 'TalanganLunas',
    amount: 100000,
    period: 0,
    txHash: '0xdef',
    createdAt: new Date('2026-07-09T00:00:00.000Z'),
  };

  it('detail returns member + savings + loans + renteng history', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    prisma.savingTransaction.findMany.mockResolvedValue([savingRow]);
    prisma.loan.findMany.mockResolvedValue([loanRow]);
    prisma.rentengEvent.findMany.mockResolvedValue([rentengNew, rentengOld]);

    const result = await service.detail('m-1');

    expect(result.member.id).toBe('m-1');
    expect(result.savings).toHaveLength(1);
    expect(result.savings[0].nominal).toBe(50000);
    expect(typeof result.savings[0].nominal).toBe('number');
    expect(result.loans).toHaveLength(1);
    expect(result.loans[0].id).toBe('l-1');
    // onchainLoanId (BigInt) surfaced as a string by toLoanDto
    expect(result.loans[0].onchainLoanId).toBe('7');
    expect(result.rentengHistory).toHaveLength(2);
  });

  it('detail returns renteng history newest-first with amount as number', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    prisma.savingTransaction.findMany.mockResolvedValue([]);
    prisma.loan.findMany.mockResolvedValue([]);
    // Service delegates ordering to Prisma orderBy desc; assert it requested that.
    prisma.rentengEvent.findMany.mockResolvedValue([rentengNew, rentengOld]);

    const result = await service.detail('m-1');

    expect(prisma.rentengEvent.findMany).toHaveBeenCalledWith({
      where: { memberId: 'm-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.rentengHistory.map((e) => e.id)).toEqual(['re-2', 're-1']);
    expect(result.rentengHistory[0].amount).toBe(100000);
    expect(typeof result.rentengHistory[0].amount).toBe('number');
  });

  it('detail returns an empty renteng history for a member with no events', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    prisma.savingTransaction.findMany.mockResolvedValue([]);
    prisma.loan.findMany.mockResolvedValue([]);
    prisma.rentengEvent.findMany.mockResolvedValue([]);

    const result = await service.detail('m-1');

    expect(result.rentengHistory).toEqual([]);
    expect(result.savings).toEqual([]);
    expect(result.loans).toEqual([]);
  });

  it('detail throws NotFoundException for an unknown id', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.detail('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.savingTransaction.findMany).not.toHaveBeenCalled();
    expect(prisma.loan.findMany).not.toHaveBeenCalled();
    expect(prisma.rentengEvent.findMany).not.toHaveBeenCalled();
  });

  it('detail never serializes member secrets', async () => {
    prisma.member.findUnique.mockResolvedValue(anggota);
    prisma.savingTransaction.findMany.mockResolvedValue([savingRow]);
    prisma.loan.findMany.mockResolvedValue([loanRow]);
    prisma.rentengEvent.findMany.mockResolvedValue([rentengOld]);

    const result = await service.detail('m-1');

    expect((result.member as any).passwordHash).toBeUndefined();
    expect((result.member as any).encryptedPrivkey).toBeUndefined();
  });
});
