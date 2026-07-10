import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { SavingJenis } from '@prisma/client';

/**
 * Payload for recording a simpanan (`POST /api/savings`). QRIS is simulated —
 * `metode` defaults to 'QRIS' and the request itself confirms the payment.
 */
export class CreateSavingDto {
  @IsUUID()
  memberId: string;

  @IsEnum(SavingJenis)
  jenis: SavingJenis;

  @IsNumber()
  @IsPositive()
  nominal: number;

  @IsOptional()
  @IsString()
  metode?: string = 'QRIS';
}
