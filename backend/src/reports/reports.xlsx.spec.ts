import * as ExcelJS from 'exceljs';
import { buildERatWorkbook } from './reports.xlsx';
import { ERatReport } from './reports.service';

function sampleReport(): ERatReport {
  return {
    generatedAt: new Date('2026-07-11T00:00:00.000Z'),
    summary: {
      totalAnggota: 2,
      anggotaApproved: 1,
      totalSimpanan: 275000,
      totalKasSosial: 300000,
      totalPinjaman: 3500000,
      pinjamanAktif: 2,
      rentengAktif: 1,
    },
    charts: {
      loansByFlag: [
        { flag: 'HIJAU', count: 2 },
        { flag: 'KUNING', count: 0 },
        { flag: 'MERAH', count: 1 },
      ],
      loansByStatus: [{ status: 'Cair', count: 2 }],
      simpananByJenis: [{ jenis: 'Pokok', total: 200000 }],
      savingsOverTime: [{ month: '2026-07', total: 75000 }],
    },
    tables: {
      anggota: [
        {
          nama: 'Ani',
          nik: '3200000000000001',
          statusKyc: 'Approved',
          skorKeanggotaan: 90,
          simpananTotal: 175000,
          walletAddress: '0xabc',
        },
      ],
      pinjaman: [
        {
          memberNama: 'Ani',
          nominal: 1000000,
          status: 'Cair',
          statusCicilan: 'UNPAID',
          flagAi: 'HIJAU',
          skorAi: 80,
        },
      ],
      tanggungRenteng: [
        {
          memberNama: 'Budi',
          event: 'BAILOUT',
          amount: 250000,
          period: 3,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ],
    },
  };
}

describe('buildERatWorkbook', () => {
  it('returns a non-empty Buffer', async () => {
    const buffer = await buildERatWorkbook(sampleReport());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('produces a workbook with the four expected sheets', async () => {
    const buffer = await buildERatWorkbook(sampleReport());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toEqual([
      'Ringkasan',
      'Anggota',
      'Pinjaman',
      'Tanggung Renteng',
    ]);
  });

  it('Anggota sheet has the header row and the data rows', async () => {
    const buffer = await buildERatWorkbook(sampleReport());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const anggota = wb.getWorksheet('Anggota');
    expect(anggota).toBeDefined();
    const header = anggota!.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([
      'Nama',
      'NIK',
      'Status KYC',
      'Skor Keanggotaan',
      'Simpanan Total',
      'Wallet Address',
    ]);
    const dataRow = anggota!.getRow(2).values as unknown[];
    expect(dataRow.slice(1)).toEqual([
      'Ani',
      '3200000000000001',
      'Approved',
      90,
      175000,
      '0xabc',
    ]);
    // header + 1 data row
    expect(anggota!.rowCount).toBe(2);
  });

  it('handles empty tables without crashing', async () => {
    const report = sampleReport();
    report.tables = { anggota: [], pinjaman: [], tanggungRenteng: [] };
    const buffer = await buildERatWorkbook(report);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(wb.getWorksheet('Anggota')!.rowCount).toBe(1); // header only
  });
});
