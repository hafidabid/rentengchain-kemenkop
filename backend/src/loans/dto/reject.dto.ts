import { IsOptional, IsString } from 'class-validator';

/** Payload for a Pengurus reject/hold decision (`POST /api/loans/reject/:id`). */
export class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
