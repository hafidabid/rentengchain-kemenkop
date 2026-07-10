import { Prisma } from '@prisma/client';

/**
 * Shared response serializers. Two jobs:
 *  1. Strip secrets (passwordHash, encryptedPrivkey) — they MUST never leave the API.
 *  2. Convert Prisma Decimal → number so the payload matches the mockup camelCase types.
 *
 * Every module reuses these so the "never serialize secrets" rule lives in one place.
 */

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

/** Fields that must never appear in any API response. */
const MEMBER_SECRET_FIELDS = ['passwordHash', 'encryptedPrivkey'] as const;

export interface MemberDto {
  id: string;
  nama: string;
  nik: string;
  noHp: string;
  alamat: string;
  pekerjaan: string;
  peran: string;
  statusKyc: string;
  skorKeanggotaan: number;
  ktpUrl?: string | null;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  isDorman: boolean;
  isUzur: boolean;
  jumlahIzinUzur: number;
  walletAddress: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toMemberDto(member: Record<string, any>): MemberDto {
  const dto: Record<string, any> = { ...member };
  for (const secret of MEMBER_SECRET_FIELDS) {
    delete dto[secret];
  }
  dto.simpananPokok = toNumber(member.simpananPokok);
  dto.simpananWajib = toNumber(member.simpananWajib);
  dto.simpananSukarela = toNumber(member.simpananSukarela);
  return dto as MemberDto;
}

export interface GroupDto {
  id: string;
  nama: string;
  ketuaId: string | null;
  anggotaIds: string[];
  plafonMaks: number;
  jadwalPertemuan: string;
  kehadiranRate: number;
  kasSosial: number;
  reputasiKomunitas: string;
  kodeUndangan: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @param group   the raw Prisma group record
 * @param anggotaIds member ids resolved from the member_groups bridge (NOT a column)
 */
export function toGroupDto(
  group: Record<string, any>,
  anggotaIds: string[],
): GroupDto {
  return {
    id: group.id,
    nama: group.nama,
    ketuaId: group.ketuaId ?? null,
    anggotaIds,
    plafonMaks: toNumber(group.plafonMaks),
    jadwalPertemuan: group.jadwalPertemuan,
    kehadiranRate: toNumber(group.kehadiranRate),
    kasSosial: toNumber(group.kasSosial),
    reputasiKomunitas: group.reputasiKomunitas,
    kodeUndangan: group.kodeUndangan,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export interface AuditLogDto {
  id: string;
  timestamp: Date;
  aktor: string;
  aksi: string;
  detail: string;
  txHash: string | null;
  txLink: string | null;
}

/** Derive txLink from txHash + explorer base at read time. tx_link is never stored. */
export function toAuditLogDto(
  log: Record<string, any>,
  explorerBaseUrl: string,
): AuditLogDto {
  const txHash: string | null = log.txHash ?? null;
  return {
    id: log.id,
    timestamp: log.timestamp,
    aktor: log.aktor,
    aksi: log.aksi,
    detail: log.detail,
    txHash,
    txLink: txHash
      ? `${explorerBaseUrl.replace(/\/$/, '')}/tx/${txHash}`
      : null,
  };
}
