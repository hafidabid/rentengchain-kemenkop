import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MembersService } from './members.service';

describe('MembersService', () => {
  let service: MembersService;
  let prisma: { member: { findMany: jest.Mock; findUnique: jest.Mock } };

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
});
