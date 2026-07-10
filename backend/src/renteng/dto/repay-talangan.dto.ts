import { IsNumber, IsPositive } from 'class-validator';

/** Payload for a shallow talangan settlement (`POST /api/renteng/:loanId/repay-talangan`). */
export class RepayTalanganDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
