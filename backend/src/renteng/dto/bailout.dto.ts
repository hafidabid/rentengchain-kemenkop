import { IsInt, IsOptional, IsPositive } from 'class-validator';

/**
 * Payload for a tanggung renteng bailout (`POST /api/renteng/:loanId/bailout`).
 * Both fields are optional: `period` is the installment number being covered
 * (defaults to 1) and `gracePeriod` is the renteng freeze grace in days
 * (defaults to 30). The service applies these defaults.
 */
export class BailoutDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  period?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  gracePeriod?: number;
}
