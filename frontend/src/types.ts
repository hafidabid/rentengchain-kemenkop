// API-aligned domain types. Field names are camelCase to match the NestJS
// serializers 1:1 (see backend/src/common/serializers.ts + loans/savings serializers).

export type Peran = 'penabung' | 'peminjam' | 'keduanya';
export type StatusKyc = 'Requested' | 'Approved' | 'Rejected';
export type Role = 'Anggota' | 'Pengurus';
export type ReputasiKomunitas = 'baik' | 'cukup' | 'kurang';
export type LoanStatus =
  | 'Diajukan'
  | 'Disetujui'
  | 'Cair'
  | 'Lunas'
  | 'Mangkir'
  | 'Ditunda';
export type StatusCicilan = 'PAID' | 'UNPAID' | 'TUNGGAKAN' | 'DITALANGI';
export type FlagAi = 'HIJAU' | 'KUNING' | 'MERAH';
export type SavingJenis = 'Pokok' | 'Wajib' | 'Sukarela';

export interface Member {
  id: string;
  nama: string;
  nik: string;
  noHp: string;
  alamat: string;
  pekerjaan: string;
  peran: Peran;
  statusKyc: StatusKyc;
  skorKeanggotaan: number;
  ktpUrl?: string | null;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  isDorman: boolean;
  isUzur: boolean;
  jumlahIzinUzur: number;
  walletAddress: string | null;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
}

export interface Group {
  id: string;
  nama: string;
  ketuaId: string | null;
  anggotaIds: string[];
  plafonMaks: number;
  jadwalPertemuan: string;
  kehadiranRate: number;
  kasSosial: number;
  reputasiKomunitas: ReputasiKomunitas;
  kodeUndangan: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Loan {
  id: string;
  memberId: string;
  groupId: string;
  nominal: number;
  tujuan: string;
  tenor: number;
  status: LoanStatus;
  statusCicilan: StatusCicilan;
  sisaCicilan: number;
  cicilanBulanan: number;
  jadwalCicilan: string;
  skorAi: number;
  flagAi: FlagAi;
  flagAlasan: string[];
  isSanggah: boolean;
  sanggahAlasan?: string | null;
  onchainLoanId?: string | null;
  txHash?: string | null;
  txLink?: string | null;
  memberNama?: string;
  groupNama?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavingTransaction {
  id: string;
  memberId: string;
  jenis: SavingJenis;
  nominal: number;
  tanggal: string;
  metode: string;
  status: 'PAID' | 'PENDING';
  txHash?: string | null;
  txLink?: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  aktor: string;
  aksi: string;
  detail: string;
  txHash?: string | null;
  txLink?: string | null;
}

export interface LoginResult {
  accessToken: string;
  member: Member;
}

export interface BailoutResult {
  loan: Loan;
  group: { id: string; kasSosial: number };
}

export interface OnchainStatus {
  relayerAddress: string | null;
  adminAddress: string | null;
  canRelayerWrite: boolean;
  canKoperasiWrite: boolean;
}
