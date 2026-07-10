export interface Member {
  id: string;
  nama: string;
  nik: string;
  noHp: string;
  alamat: string;
  pekerjaan: string;
  peran: 'penabung' | 'peminjam' | 'keduanya';
  statusKyc: 'Requested' | 'Approved' | 'Rejected';
  skorKeanggotaan: number; // 0 - 100
  ktpUrl?: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  isDorman: boolean;
  isUzur: boolean;
  jumlahIzinUzur: number; // Max 2 per year
}

export interface Group {
  id: string;
  nama: string;
  ketuaId: string;
  anggotaIds: string[];
  plafonMaks: number;
  jadwalPertemuan: string; // e.g., "Setiap tanggal 5"
  kehadiranRate: number; // 0 - 100
  kasSosial: number;
  reputasiKomunitas: 'baik' | 'cukup' | 'kurang';
  kodeUndangan: string;
}

export interface Loan {
  id: string;
  memberId: string;
  groupId: string;
  nominal: number;
  tujuan: string;
  tenor: number; // Bulan
  status: 'Diajukan' | 'Disetujui' | 'Cair' | 'Lunas' | 'Mangkir' | 'Ditunda';
  statusCicilan: 'PAID' | 'UNPAID' | 'TUNGGAKAN' | 'DITALANGI';
  sisaCicilan: number; // Bulan sisa
  cicilanBulanan: number;
  jadwalCicilan: string;
  skorAi: number;
  flagAi: 'HIJAU' | 'KUNING' | 'MERAH';
  flagAlasan: string[];
  isSanggah: boolean;
  sanggahAlasan?: string;
}

export interface SavingTransaction {
  id: string;
  memberId: string;
  jenis: 'Pokok' | 'Wajib' | 'Sukarela';
  nominal: number;
  tanggal: string;
  metode: string;
  status: 'PAID' | 'PENDING';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  aktor: string;
  aksi: string;
  detail: string;
}
