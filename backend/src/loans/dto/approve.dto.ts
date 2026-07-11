import { IsOptional, IsString } from 'class-validator';

/** Payload for a Pengurus approve decision (`POST /api/loans/approve/:id`). */
export class ApproveDto {
  @IsOptional()
  @IsString()
  note?: string;
}
