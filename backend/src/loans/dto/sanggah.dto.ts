import { IsNotEmpty, IsString } from 'class-validator';

/** Payload for a member appeal (`POST /api/loans/sanggah/:id`). The raw text is
 * stored off-chain; only a salted reasonHash is ever submitted on-chain. */
export class SanggahDto {
  @IsString()
  @IsNotEmpty()
  alasan: string;
}
