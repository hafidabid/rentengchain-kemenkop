import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/serializers';

/** AI risk flags rendered in the e-RAT loan chart (fixed, ordered set). */
const LOAN_FLAGS = ['HIJAU', 'KUNING', 'MERAH'] as const;
/** Savings buckets rendered in the e-RAT savings chart. */
const SAVING_JENIS = ['Pokok', 'Wajib', 'Sukarela'] as const;
/** How many trailing calendar months the savings-over-time series covers. */
const SAVINGS_MONTHS = 6;

export interface ERatSummary {
  totalAnggota: number;
  anggotaApproved: number;
  totalSimpanan: number;
  totalKasSosial: number;
  totalPinjaman: number;
  pinjamanAktif: number;
  rentengAktif: number;
}

export interface ERatCharts {
  loansByFlag: { flag: string; count: number }[];
  loansByStatus: { status: string; count: number }[];
  simpananByJenis: { jenis: string; total: number }[];
  savingsOverTime: { month: string; total: number }[];
}

export interface ERatAnggotaRow {
  nama: string;
  nik: string;
  statusKyc: string;
  skorKeanggotaan: number;
  simpananTotal: number;
  walletAddress: string | null;
}

export interface ERatPinjamanRow {
  memberNama: string;
  nominal: number;
  status: string;
  statusCicilan: string;
  flagAi: string;
  skorAi: number;
}

export interface ERatRentengRow {
  memberNama: string;
  event: string;
  amount: number;
  period: number;
  createdAt: Date;
}

export interface ERatTables {
  anggota: ERatAnggotaRow[];
  pinjaman: ERatPinjamanRow[];
  tanggungRenteng: ERatRentengRow[];
}

export interface ERatReport {
  generatedAt: Date;
  summary: ERatSummary;
  charts: ERatCharts;
  tables: ERatTables;
}

/** Format a Date as a `YYYY-MM` month bucket key. */
function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Read-side aggregation for the Pengurus e-RAT report. Pulls the current data
 * with a handful of Prisma reads and derives chart-ready series + tabular rows.
 * All Prisma Decimals are converted to plain numbers before leaving the service.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async eRat(): Promise<ERatReport> {
    const generatedAt = new Date();
    const savingsSince = new Date(generatedAt);
    savingsSince.setUTCMonth(savingsSince.getUTCMonth() - (SAVINGS_MONTHS - 1));
    savingsSince.setUTCDate(1);
    savingsSince.setUTCHours(0, 0, 0, 0);

    const [members, loans, rentengEvents, savings, groupAgg] =
      await Promise.all([
        this.prisma.member.findMany({ orderBy: { nama: 'asc' } }),
        this.prisma.loan.findMany({
          orderBy: { createdAt: 'desc' },
          include: { member: { select: { nama: true } } },
        }),
        this.prisma.rentengEvent.findMany({
          orderBy: { createdAt: 'desc' },
          include: { member: { select: { nama: true } } },
        }),
        this.prisma.savingTransaction.findMany({
          where: { tanggal: { gte: savingsSince } },
          orderBy: { tanggal: 'asc' },
        }),
        this.prisma.group.aggregate({ _sum: { kasSosial: true } }),
      ]);

    // --- Members / savings buckets ---
    let sumPokok = 0;
    let sumWajib = 0;
    let sumSukarela = 0;
    let anggotaApproved = 0;
    const anggota: ERatAnggotaRow[] = members.map((m) => {
      const pokok = toNumber(m.simpananPokok);
      const wajib = toNumber(m.simpananWajib);
      const sukarela = toNumber(m.simpananSukarela);
      sumPokok += pokok;
      sumWajib += wajib;
      sumSukarela += sukarela;
      if (m.statusKyc === 'Approved') anggotaApproved += 1;
      return {
        nama: m.nama,
        nik: m.nik,
        statusKyc: m.statusKyc,
        skorKeanggotaan: m.skorKeanggotaan,
        simpananTotal: pokok + wajib + sukarela,
        walletAddress: m.walletAddress ?? null,
      };
    });

    // --- Loans: table rows + flag/status charts + summary counts ---
    const flagCounts = new Map<string, number>(
      LOAN_FLAGS.map((f) => [f, 0]),
    );
    const statusCounts = new Map<string, number>();
    let totalPinjaman = 0;
    let pinjamanAktif = 0;
    let rentengAktif = 0;
    const pinjaman: ERatPinjamanRow[] = loans.map((l) => {
      const nominal = toNumber(l.nominal);
      totalPinjaman += nominal;
      flagCounts.set(l.flagAi, (flagCounts.get(l.flagAi) ?? 0) + 1);
      statusCounts.set(l.status, (statusCounts.get(l.status) ?? 0) + 1);
      if (l.status === 'Cair') pinjamanAktif += 1;
      if (l.statusCicilan === 'DITALANGI') rentengAktif += 1;
      return {
        memberNama: l.member?.nama ?? '',
        nominal,
        status: l.status,
        statusCicilan: l.statusCicilan,
        flagAi: l.flagAi,
        skorAi: l.skorAi,
      };
    });

    // --- Savings over time (grouped by month) ---
    const monthTotals = new Map<string, number>();
    for (const s of savings) {
      const key = monthKey(s.tanggal);
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + toNumber(s.nominal));
    }
    const savingsOverTime = Array.from(monthTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    // --- Renteng activity table ---
    const tanggungRenteng: ERatRentengRow[] = rentengEvents.map((e) => ({
      memberNama: e.member?.nama ?? '',
      event: e.event,
      amount: toNumber(e.amount),
      period: e.period,
      createdAt: e.createdAt,
    }));

    const totalKasSosial = toNumber(groupAgg._sum.kasSosial);

    return {
      generatedAt,
      summary: {
        totalAnggota: members.length,
        anggotaApproved,
        totalSimpanan: sumPokok + sumWajib + sumSukarela,
        totalKasSosial,
        totalPinjaman,
        pinjamanAktif,
        rentengAktif,
      },
      charts: {
        loansByFlag: LOAN_FLAGS.map((flag) => ({
          flag,
          count: flagCounts.get(flag) ?? 0,
        })),
        loansByStatus: Array.from(statusCounts.entries()).map(
          ([status, count]) => ({ status, count }),
        ),
        simpananByJenis: [
          { jenis: SAVING_JENIS[0], total: sumPokok },
          { jenis: SAVING_JENIS[1], total: sumWajib },
          { jenis: SAVING_JENIS[2], total: sumSukarela },
        ],
        savingsOverTime,
      },
      tables: { anggota, pinjaman, tanggungRenteng },
    };
  }
}
