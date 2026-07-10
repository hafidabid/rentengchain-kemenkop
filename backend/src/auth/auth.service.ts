import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MemberDto, toMemberDto } from '../common/serializers';
import { JwtPayload } from './strategies/jwt.strategy';

export interface LoginResult {
  accessToken: string;
  member: MemberDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(identifier: string, password: string): Promise<LoginResult> {
    const member = await this.prisma.member.findUnique({
      where: { nik: identifier },
    });

    // Uniform failure for unknown user or bad password (no user enumeration).
    if (!member || !member.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, member.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: member.id, role: member.role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, member: toMemberDto(member) };
  }

  async me(userId: string): Promise<MemberDto> {
    const member = await this.prisma.member.findUnique({
      where: { id: userId },
    });
    if (!member) {
      throw new UnauthorizedException('Unknown user');
    }
    return toMemberDto(member);
  }
}
