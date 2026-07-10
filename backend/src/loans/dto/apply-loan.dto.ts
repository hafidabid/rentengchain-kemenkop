import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

/**
 * Payload for a group-bound loan application (`POST /api/loans/apply`).
 * `cicilanBulanan` is optional — when omitted the service seeds a flat
 * installment of round(nominal / tenor).
 */
export class ApplyLoanDto {
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsNumber()
  @IsPositive()
  nominal: number;

  @IsString()
  @IsNotEmpty()
  tujuan: string;

  @IsInt()
  @IsPositive()
  tenor: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  cicilanBulanan?: number;
}
