import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: {
    group: { findMany: jest.Mock; findUnique: jest.Mock };
    memberGroup: { findMany: jest.Mock };
  };

  // Seeded "Mekar Wangi Srikandi" group. anggotaIds is NEVER a stored column —
  // it is assembled from the member_groups bridge at read time.
  const group = {
    id: 'g-1',
    nama: 'Mekar Wangi Srikandi',
    ketuaId: 'm-sri',
    plafonMaks: '5000000',
    jadwalPertemuan: 'Setiap Jumat',
    kehadiranRate: '0.95',
    kasSosial: '250000',
    reputasiKomunitas: 'Baik',
    kodeUndangan: 'MWS-2026',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };

  const bridgeRows = [
    { memberId: 'm-sri', groupId: 'g-1', joinedAt: new Date() },
    { memberId: 'm-deni', groupId: 'g-1', joinedAt: new Date() },
    { memberId: 'm-ani', groupId: 'g-1', joinedAt: new Date() },
  ];

  beforeEach(async () => {
    prisma = {
      group: { findMany: jest.fn(), findUnique: jest.fn() },
      memberGroup: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(GroupsService);
  });

  // --- Positive ---
  it('findOne assembles anggotaIds from the member_groups bridge', async () => {
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.memberGroup.findMany.mockResolvedValue(bridgeRows);

    const dto = await service.findOne('g-1');

    expect(prisma.memberGroup.findMany).toHaveBeenCalledWith({
      where: { groupId: 'g-1' },
    });
    expect(dto.anggotaIds).toEqual(['m-sri', 'm-deni', 'm-ani']);
  });

  it('findOne exposes kasSosial as a number and kodeUndangan', async () => {
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.memberGroup.findMany.mockResolvedValue(bridgeRows);

    const dto = await service.findOne('g-1');

    expect(dto.kasSosial).toBe(250000);
    expect(typeof dto.kasSosial).toBe('number');
    expect(dto.kodeUndangan).toBe('MWS-2026');
    // Decimal fields converted to numbers.
    expect(dto.plafonMaks).toBe(5000000);
    expect(dto.kehadiranRate).toBe(0.95);
  });

  it('findAll returns the seeded group with its resolved anggotaIds', async () => {
    prisma.group.findMany.mockResolvedValue([group]);
    prisma.memberGroup.findMany.mockResolvedValue(bridgeRows);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g-1');
    expect(result[0].kodeUndangan).toBe('MWS-2026');
    expect(result[0].anggotaIds).toEqual(['m-sri', 'm-deni', 'm-ani']);
  });

  // --- Edge cases ---
  it('findOne throws NotFoundException for an unknown id', async () => {
    prisma.group.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // No bridge lookup once the group is missing.
    expect(prisma.memberGroup.findMany).not.toHaveBeenCalled();
  });

  it('findOne yields anggotaIds: [] when the bridge has zero rows', async () => {
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.memberGroup.findMany.mockResolvedValue([]);

    const dto = await service.findOne('g-1');

    expect(dto.anggotaIds).toEqual([]);
  });
});
