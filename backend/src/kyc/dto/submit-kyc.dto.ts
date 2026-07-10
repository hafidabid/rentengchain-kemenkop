import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Peran } from '@prisma/client';

/**
 * Payload for a member-facing KYC submission (`POST /api/kyc/submit`). The KTP
 * is a pre-seeded URL — no file upload wiring this phase.
 */
export class SubmitKycDto {
  @IsString()
  @IsNotEmpty()
  nama: string;

  @IsString()
  @IsNotEmpty()
  nik: string;

  @IsString()
  @IsNotEmpty()
  noHp: string;

  @IsString()
  @IsNotEmpty()
  alamat: string;

  @IsString()
  @IsNotEmpty()
  pekerjaan: string;

  @IsEnum(Peran)
  peran: Peran;

  @IsOptional()
  @IsString()
  ktpUrl?: string;
}
