import { toNumber } from '../common/serializers';

/**
 * API shape for a loan. Two invariants live here:
 *  1. Prisma `Decimal` (nominal, cicilanBulanan) → `number`.
 *  2. `onchainLoanId` is a Prisma `BigInt?` — JSON cannot serialize BigInt, so
 *     it is emitted as a decimal string (or null).
 * `flagAlasan` is stored as JSON and always surfaced as a `string[]`.
 */
export interface LoanDto {
  id: string;
  memberId: string;
  groupId: string;
  nominal: number;
  tujuan: string;
  tenor: number;
  status: string;
  statusCicilan: string;
  sisaCicilan: number;
  cicilanBulanan: number;
  jadwalCicilan: string;
  skorAi: number;
  flagAi: string;
  flagAlasan: string[];
  isSanggah: boolean;
  sanggahAlasan: string | null;
  catatanPengurus: string | null;
  onchainLoanId: string | null;
  txHash: string | null;
  txLink: string | null;
  memberNama?: string;
  groupNama?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanDtoExtra {
  memberNama?: string;
  groupNama?: string;
  explorerBaseUrl?: string;
}

/** API shape for one entry in a loan's decision history. */
export interface LoanDecisionDto {
  id: string;
  decision: string;
  note: string | null;
  aktor: string;
  createdAt: Date;
}

/** Map a Prisma `loanDecision` row to its API shape. */
export function toLoanDecisionDto(
  decision: Record<string, any>,
): LoanDecisionDto {
  return {
    id: decision.id,
    decision: decision.decision,
    note: decision.note ?? null,
    aktor: decision.aktor,
    createdAt: decision.createdAt,
  };
}

/** Coerce a Prisma Json `flagAlasan` (array, JSON string, or null) into string[]. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toLoanDto(
  loan: Record<string, any>,
  extra: LoanDtoExtra = {},
): LoanDto {
  const txHash: string | null = loan.txHash ?? null;
  const explorerBase = extra.explorerBaseUrl ?? 'https://sepolia.basescan.org';
  const onchainLoanId =
    loan.onchainLoanId !== null && loan.onchainLoanId !== undefined
      ? loan.onchainLoanId.toString()
      : null;

  return {
    id: loan.id,
    memberId: loan.memberId,
    groupId: loan.groupId,
    nominal: toNumber(loan.nominal),
    tujuan: loan.tujuan,
    tenor: loan.tenor,
    status: loan.status,
    statusCicilan: loan.statusCicilan,
    sisaCicilan: loan.sisaCicilan,
    cicilanBulanan: toNumber(loan.cicilanBulanan),
    jadwalCicilan: loan.jadwalCicilan,
    skorAi: loan.skorAi,
    flagAi: loan.flagAi,
    flagAlasan: toStringArray(loan.flagAlasan),
    isSanggah: loan.isSanggah ?? false,
    sanggahAlasan: loan.sanggahAlasan ?? null,
    catatanPengurus: loan.catatanPengurus ?? null,
    onchainLoanId,
    txHash,
    txLink: txHash
      ? `${explorerBase.replace(/\/$/, '')}/tx/${txHash}`
      : null,
    memberNama: extra.memberNama ?? loan.member?.nama,
    groupNama: extra.groupNama ?? loan.group?.nama,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  };
}
