import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    member: { findMany: jest.Mock };
    loan: { findMany: jest.Mock };
    rentengEvent: { findMany: jest.Mock };
    savingTransaction: { findMany: jest.Mock };
    group: { aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      member: { findMany: jest.fn() },
      loan: { findMany: jest.fn() },
      rentengEvent: { findMany: jest.fn() },
      savingTransaction: { findMany: jest.fn() },
      group: { aggregate: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  function seed() {
    prisma.member.findMany.mockResolvedValue([
      {
        nama: 'Ani',
        nik: '3200000000000001',
        statusKyc: 'Approved',
        skorKeanggotaan: 90,
        simpananPokok: '100000',
        simpananWajib: '50000',
        simpananSukarela: '25000',
        walletAddress: '0xabc',
      },
      {
        nama: 'Budi',
        nik: '3200000000000002',
        statusKyc: 'Requested',
        skorKeanggotaan: 70,
        simpananPokok: '100000',
        simpananWajib: '0',
        simpananSukarela: '0',
        walletAddress: null,
      },
    ]);
    prisma.loan.findMany.mockResolvedValue([
      {
        nominal: '1000000',
        status: 'Cair',
        statusCicilan: 'UNPAID',
        flagAi: 'HIJAU',
        skorAi: 80,
        member: { nama: 'Ani' },
      },
      {
        nominal: '2000000',
        status: 'Cair',
        statusCicilan: 'DITALANGI',
        flagAi: 'MERAH',
        skorAi: 30,
        member: { nama: 'Budi' },
      },
      {
        nominal: '500000',
        status: 'Lunas',
        statusCicilan: 'PAID',
        flagAi: 'HIJAU',
        skorAi: 95,
        member: { nama: 'Ani' },
      },
    ]);
    prisma.rentengEvent.findMany.mockResolvedValue([
      {
        event: 'BAILOUT',
        amount: '250000',
        period: 3,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        member: { nama: 'Budi' },
      },
    ]);
    prisma.savingTransaction.findMany.mockResolvedValue([
      { nominal: '100000', tanggal: new Date('2026-06-10T00:00:00.000Z') },
      { nominal: '50000', tanggal: new Date('2026-06-20T00:00:00.000Z') },
      { nominal: '75000', tanggal: new Date('2026-07-05T00:00:00.000Z') },
    ]);
    prisma.group.aggregate.mockResolvedValue({ _sum: { kasSosial: '300000' } });
  }

  // --- Positive ---
  it('summary aggregates members, savings, loans and kas sosial', async () => {
    seed();
    const { summary } = await service.eRat();

    expect(summary.totalAnggota).toBe(2);
    expect(summary.anggotaApproved).toBe(1);
    expect(summary.totalSimpanan).toBe(275000); // 175000 + 100000
    expect(summary.totalKasSosial).toBe(300000);
    expect(summary.totalPinjaman).toBe(3500000);
    expect(summary.pinjamanAktif).toBe(2); // two Cair
    expect(summary.rentengAktif).toBe(1); // one DITALANGI
  });

  it('loansByFlag always reports HIJAU/KUNING/MERAH with correct counts', async () => {
    seed();
    const { charts } = await service.eRat();

    expect(charts.loansByFlag).toEqual([
      { flag: 'HIJAU', count: 2 },
      { flag: 'KUNING', count: 0 },
      { flag: 'MERAH', count: 1 },
    ]);
  });

  it('simpananByJenis totals per bucket and loansByStatus counts', async () => {
    seed();
    const { charts } = await service.eRat();

    expect(charts.simpananByJenis).toEqual([
      { jenis: 'Pokok', total: 200000 },
      { jenis: 'Wajib', total: 50000 },
      { jenis: 'Sukarela', total: 25000 },
    ]);
    const status = new Map(
      charts.loansByStatus.map((s) => [s.status, s.count]),
    );
    expect(status.get('Cair')).toBe(2);
    expect(status.get('Lunas')).toBe(1);
  });

  it('savingsOverTime groups transactions by month, ascending', async () => {
    seed();
    const { charts } = await service.eRat();

    expect(charts.savingsOverTime).toEqual([
      { month: '2026-06', total: 150000 },
      { month: '2026-07', total: 75000 },
    ]);
  });

  it('tables carry the expected rows with Decimals converted to numbers', async () => {
    seed();
    const { tables } = await service.eRat();

    expect(tables.anggota[0]).toMatchObject({
      nama: 'Ani',
      simpananTotal: 175000,
      walletAddress: '0xabc',
    });
    expect(tables.anggota[1].walletAddress).toBeNull();
    expect(tables.pinjaman[0]).toMatchObject({
      memberNama: 'Ani',
      nominal: 1000000,
      flagAi: 'HIJAU',
    });
    expect(tables.tanggungRenteng[0]).toMatchObject({
      memberNama: 'Budi',
      event: 'BAILOUT',
      amount: 250000,
      period: 3,
    });
  });

  // --- Edge ---
  it('empty data yields zeros and empty arrays without crashing', async () => {
    prisma.member.findMany.mockResolvedValue([]);
    prisma.loan.findMany.mockResolvedValue([]);
    prisma.rentengEvent.findMany.mockResolvedValue([]);
    prisma.savingTransaction.findMany.mockResolvedValue([]);
    prisma.group.aggregate.mockResolvedValue({ _sum: { kasSosial: null } });

    const report = await service.eRat();

    expect(report.summary).toEqual({
      totalAnggota: 0,
      anggotaApproved: 0,
      totalSimpanan: 0,
      totalKasSosial: 0,
      totalPinjaman: 0,
      pinjamanAktif: 0,
      rentengAktif: 0,
    });
    expect(report.charts.loansByFlag).toEqual([
      { flag: 'HIJAU', count: 0 },
      { flag: 'KUNING', count: 0 },
      { flag: 'MERAH', count: 0 },
    ]);
    expect(report.charts.loansByStatus).toEqual([]);
    expect(report.charts.savingsOverTime).toEqual([]);
    expect(report.tables.anggota).toEqual([]);
    expect(report.tables.pinjaman).toEqual([]);
    expect(report.tables.tanggungRenteng).toEqual([]);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });
});
