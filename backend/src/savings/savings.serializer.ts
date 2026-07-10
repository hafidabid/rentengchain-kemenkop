import { toNumber } from '../common/serializers';

/**
 * Response shape for a saving transaction. `txLink` is NEVER stored; it is
 * derived at read time from `txHash` + the configured explorer base URL, matching
 * the audit-log convention.
 */
export interface SavingDto {
  id: string;
  memberId: string;
  jenis: string;
  nominal: number;
  tanggal: Date;
  metode: string;
  status: string;
  txHash: string | null;
  txLink: string | null;
}

/** Map a raw Prisma saving row to a camelCase DTO with a derived txLink. */
export function toSavingDto(
  row: Record<string, any>,
  explorerBaseUrl: string,
): SavingDto {
  const txHash: string | null = row.txHash ?? null;
  return {
    id: row.id,
    memberId: row.memberId,
    jenis: row.jenis,
    nominal: toNumber(row.nominal),
    tanggal: row.tanggal,
    metode: row.metode,
    status: row.status,
    txHash,
    txLink: txHash
      ? `${explorerBaseUrl.replace(/\/$/, '')}/tx/${txHash}`
      : null,
  };
}
