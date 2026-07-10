import { Member, Group, Loan, SavingTransaction, AuditLog } from './types';

export const initialMembers: Member[] = [
  {
    id: 'm1',
    nama: 'Bu Sri Rahayu',
    nik: '3273012345670001',
    noHp: '081234567890',
    alamat: 'RT 03 / RW 05, Desa Sukamaju',
    pekerjaan: 'Pengrajin Anyaman',
    peran: 'keduanya',
    statusKyc: 'Approved',
    skorKeanggotaan: 95,
    simpananPokok: 100000,
    simpananWajib: 450000,
    simpananSukarela: 1200000,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0
  },
  {
    id: 'm2',
    nama: 'Pak Deni Kurnia',
    nik: '3273012345670002',
    noHp: '081234567891',
    alamat: 'RT 01 / RW 05, Desa Sukamaju',
    pekerjaan: 'Petani Sayur',
    peran: 'peminjam',
    statusKyc: 'Approved',
    skorKeanggotaan: 78,
    simpananPokok: 100000,
    simpananWajib: 200000,
    simpananSukarela: 50000,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0
  },
  {
    id: 'm3',
    nama: 'Pak X (Suhendar)',
    nik: '3273012345670003',
    noHp: '081234567892',
    alamat: 'RT 04 / RW 02, Desa Sukakarya',
    pekerjaan: 'Pedagang Kelontong',
    peran: 'peminjam',
    statusKyc: 'Approved',
    skorKeanggotaan: 48,
    simpananPokok: 100000,
    simpananWajib: 150000,
    simpananSukarela: 20000,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0
  },
  {
    id: 'm4',
    nama: 'Bu Y (Siti Aminah)',
    nik: '3273012345670004',
    noHp: '081234567893',
    alamat: 'RT 02 / RW 02, Desa Sukakarya',
    pekerjaan: 'Peternak Bebek',
    peran: 'keduanya',
    statusKyc: 'Approved',
    skorKeanggotaan: 68,
    simpananPokok: 100000,
    simpananWajib: 300000,
    simpananSukarela: 500000,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0
  },
  {
    id: 'm5',
    nama: 'Bu Aminah Gani',
    nik: '3273012345670005',
    noHp: '081234567894',
    alamat: 'RT 03 / RW 05, Desa Sukamaju',
    pekerjaan: 'Penjual Kue',
    peran: 'penabung',
    statusKyc: 'Approved',
    skorKeanggotaan: 88,
    simpananPokok: 100000,
    simpananWajib: 500000,
    simpananSukarela: 2500000,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0
  },
  {
    id: 'm6',
    nama: 'Pak Budi Santoso',
    nik: '3273012345670006',
    noHp: '081234567895',
    alamat: 'RT 04 / RW 02, Desa Sukakarya',
    pekerjaan: 'Buruh Bangunan',
    peran: 'peminjam',
    statusKyc: 'Requested',
    skorKeanggotaan: 50,
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
    isDorman: true,
    isUzur: false,
    jumlahIzinUzur: 0
  }
];

export const initialGroups: Group[] = [
  {
    id: 'g1',
    nama: 'Mawar Melati (Sukamaju)',
    ketuaId: 'm1',
    anggotaIds: ['m1', 'm2', 'm5'],
    plafonMaks: 10000000,
    jadwalPertemuan: 'Setiap tanggal 5',
    kehadiranRate: 92,
    kasSosial: 350000,
    reputasiKomunitas: 'baik',
    kodeUndangan: 'MAWAR9'
  },
  {
    id: 'g2',
    nama: 'Karya Mandiri (Sukakarya)',
    ketuaId: 'm4',
    anggotaIds: ['m3', 'm4', 'm6'],
    plafonMaks: 5000000,
    jadwalPertemuan: 'Setiap tanggal 12',
    kehadiranRate: 75,
    kasSosial: 120000,
    reputasiKomunitas: 'cukup',
    kodeUndangan: 'KARYA4'
  }
];

export const initialLoans: Loan[] = [
  {
    id: 'l1',
    memberId: 'm1',
    groupId: 'g1',
    nominal: 5000000,
    tujuan: 'Membeli bahan anyaman rotan',
    tenor: 10,
    status: 'Cair',
    statusCicilan: 'PAID',
    sisaCicilan: 6,
    cicilanBulanan: 550000,
    jadwalCicilan: '2026-07-05',
    skorAi: 95,
    flagAi: 'HIJAU',
    flagAlasan: ['Simpanan wajib sangat tepat waktu', 'Kehadiran arisan 95%', 'Rekomendasi ketua grup positif'],
    isSanggah: false
  },
  {
    id: 'l2',
    memberId: 'm2',
    groupId: 'g1',
    nominal: 3000000,
    tujuan: 'Membeli pupuk organik',
    tenor: 6,
    status: 'Cair',
    statusCicilan: 'UNPAID',
    sisaCicilan: 3,
    cicilanBulanan: 530000,
    jadwalCicilan: '2026-07-05',
    skorAi: 78,
    flagAi: 'KUNING',
    flagAlasan: ['Pendapatan musiman tidak tetap', 'Pernah terlambat bayar wajib 1x'],
    isSanggah: false
  },
  {
    id: 'l3',
    memberId: 'm3',
    groupId: 'g2',
    nominal: 4000000,
    tujuan: 'Menambah stok toko kelontong',
    tenor: 8,
    status: 'Diajukan',
    statusCicilan: 'UNPAID',
    sisaCicilan: 8,
    cicilanBulanan: 550000,
    jadwalCicilan: '2026-07-12',
    skorAi: 48,
    flagAi: 'MERAH',
    flagAlasan: ['Terdeteksi tunggakan tersembunyi di Koperasi Tetangga (terverifikasi)', 'Plafon melebihi rasio kapasitas'],
    isSanggah: false
  },
  {
    id: 'l4',
    memberId: 'm4',
    groupId: 'g2',
    nominal: 3000000,
    tujuan: 'Pakan ternak bebek tambahan',
    tenor: 6,
    status: 'Cair',
    statusCicilan: 'PAID',
    sisaCicilan: 4,
    cicilanBulanan: 530000,
    jadwalCicilan: '2026-07-12',
    skorAi: 68,
    flagAi: 'KUNING',
    flagAlasan: ['Ada flag adverse belum terverifikasi (Pencarian Publik: nama serupa)', 'Reputasi komunitas cukup'],
    isSanggah: false
  }
];

export const initialSavings: SavingTransaction[] = [
  { id: 'tx1', memberId: 'm1', jenis: 'Pokok', nominal: 100000, tanggal: '2026-01-10', metode: 'Cash', status: 'PAID' },
  { id: 'tx2', memberId: 'm1', jenis: 'Wajib', nominal: 50000, tanggal: '2026-07-01', metode: 'QRIS', status: 'PAID' },
  { id: 'tx3', memberId: 'm2', jenis: 'Wajib', nominal: 50000, tanggal: '2026-07-04', metode: 'QRIS', status: 'PAID' },
  { id: 'tx4', memberId: 'm4', jenis: 'Wajib', nominal: 50000, tanggal: '2026-07-03', metode: 'QRIS', status: 'PAID' }
];

export const initialLogs: AuditLog[] = [
  { id: 'log1', timestamp: '2026-07-01 09:00:00', aktor: 'Sistem', aksi: 'Inisialisasi', detail: 'Aplikasi RantaiRenteng berhasil diaktifkan dengan 2 kelompok awal.' },
  { id: 'log2', timestamp: '2026-07-03 14:22:10', aktor: 'Bu Sri', aksi: 'Simpan', detail: 'Berhasil melakukan simpanan wajib Rp50.000 via QRIS.' },
  { id: 'log3', timestamp: '2026-07-04 11:05:43', aktor: 'Sistem (AI)', aksi: 'Skrining Risiko', detail: 'Skrining pinjaman Pak X selesai. Hasil: MERAH (Skor 48). Alasan: Tunggakan tersembunyi.' }
];
