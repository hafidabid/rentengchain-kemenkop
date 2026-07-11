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
  catatanPengurus?: string | null;
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

// --- Admin tools (Pengurus) ---

/** One-time credential returned to a Pengurus when approving/resetting a member. */
export interface TempCredential {
  nik: string;
  tempPassword: string;
}

/** One entry in a loan's Pengurus decision history timeline. */
export interface LoanDecision {
  id: string;
  decision: string;
  note: string | null;
  aktor: string;
  createdAt: string;
}

/** A tanggung-renteng history entry surfaced in the member detail drawer. */
export interface RentengHistoryEntry {
  id: string;
  event: string;
  amount: number;
  period: number;
  createdAt: string;
  txHash?: string | null;
  loanId?: string;
  memberId?: string;
}

/** Full Pengurus-facing member detail: profile + savings + loans + renteng. */
export interface MemberDetail {
  member: Member;
  savings: SavingTransaction[];
  loans: Loan[];
  rentengHistory: RentengHistoryEntry[];
}

// --- Assistant (Pengurus) ---

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AssistantChatResult {
  reply: string;
  grounded: boolean;
  snapshotAt: string;
  configured: boolean;
}

// --- e-RAT report (Pengurus) ---

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
  createdAt: string;
}

export interface ERatTables {
  anggota: ERatAnggotaRow[];
  pinjaman: ERatPinjamanRow[];
  tanggungRenteng: ERatRentengRow[];
}

export interface ERatReport {
  generatedAt: string;
  summary: ERatSummary;
  charts: ERatCharts;
  tables: ERatTables;
}
