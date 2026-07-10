import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /** Login identifier — a seeded member's NIK. */
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
