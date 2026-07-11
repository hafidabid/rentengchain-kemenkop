import * as ExcelJS from 'exceljs';
import { ERatReport } from './reports.service';

/**
 * Render an e-RAT report into a downloadable `.xlsx` workbook with one sheet per
 * table plus a Ringkasan (summary) sheet. Returns the encoded workbook bytes.
 */
export async function buildERatWorkbook(report: ERatReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RantaiRenteng';
  workbook.created = report.generatedAt;

  // --- Ringkasan (summary key/value) ---
  const ringkasan = workbook.addWorksheet('Ringkasan');
  ringkasan.addRow(['Metrik', 'Nilai']);
  ringkasan.addRow(['Digenerate', report.generatedAt.toISOString()]);
  ringkasan.addRow(['Total Anggota', report.summary.totalAnggota]);
  ringkasan.addRow(['Anggota Approved', report.summary.anggotaApproved]);
  ringkasan.addRow(['Total Simpanan', report.summary.totalSimpanan]);
  ringkasan.addRow(['Total Kas Sosial', report.summary.totalKasSosial]);
  ringkasan.addRow(['Total Pinjaman', report.summary.totalPinjaman]);
  ringkasan.addRow(['Pinjaman Aktif', report.summary.pinjamanAktif]);
  ringkasan.addRow(['Renteng Aktif', report.summary.rentengAktif]);

  // --- Anggota ---
  const anggota = workbook.addWorksheet('Anggota');
  anggota.addRow([
    'Nama',
    'NIK',
    'Status KYC',
    'Skor Keanggotaan',
    'Simpanan Total',
    'Wallet Address',
  ]);
  for (const row of report.tables.anggota) {
    anggota.addRow([
      row.nama,
      row.nik,
      row.statusKyc,
      row.skorKeanggotaan,
      row.simpananTotal,
      row.walletAddress ?? '',
    ]);
  }

  // --- Pinjaman ---
  const pinjaman = workbook.addWorksheet('Pinjaman');
  pinjaman.addRow([
    'Nama Anggota',
    'Nominal',
    'Status',
    'Status Cicilan',
    'Flag AI',
    'Skor AI',
  ]);
  for (const row of report.tables.pinjaman) {
    pinjaman.addRow([
      row.memberNama,
      row.nominal,
      row.status,
      row.statusCicilan,
      row.flagAi,
      row.skorAi,
    ]);
  }

  // --- Tanggung Renteng ---
  const renteng = workbook.addWorksheet('Tanggung Renteng');
  renteng.addRow(['Nama Anggota', 'Event', 'Amount', 'Period', 'Created At']);
  for (const row of report.tables.tanggungRenteng) {
    renteng.addRow([
      row.memberNama,
      row.event,
      row.amount,
      row.period,
      row.createdAt.toISOString(),
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
