import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { MemberDto, toMemberDto } from '../common/serializers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /** All members, sanitized. Pengurus-only surface (enforced at the route). */
  async findAll(): Promise<MemberDto[]> {
    const members = await this.prisma.member.findMany();
    return members.map((member) => toMemberDto(member));
  }

  /** A single member by id. Unknown id → NotFoundException. */
  async findOne(id: string): Promise<MemberDto> {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return toMemberDto(member);
  }

  /**
   * Read a member with access control: a Pengurus may read anyone, an Anggota
   * may read only their own record (else ForbiddenException).
   */
  async findOneForUser(id: string, user: AuthUser): Promise<MemberDto> {
    if (user.role !== Role.Pengurus && user.userId !== id) {
      throw new ForbiddenException('Cannot read another member');
    }
    return this.findOne(id);
  }
}
