import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { MemberDto, toMemberDto, toNumber } from '../common/serializers';
import { LoanDto, toLoanDto } from '../loans/loans.serializer';
import { PrismaService } from '../prisma/prisma.service';

/** A member's saving transaction, with Decimal nominal coerced to a number. */
export interface MemberSavingDto {
  id: string;
  jenis: string;
  nominal: number;
  tanggal: Date;
  metode: string;
  status: string;
  txHash: string | null;
  createdAt: Date;
}

/** A tanggung-renteng history entry, with Decimal amount coerced to a number. */
export interface RentengHistoryDto {
  id: string;
  memberId: string;
  loanId: string;
  event: string;
  amount: number;
  period: number;
  txHash: string | null;
  createdAt: Date;
}

/** Full Pengurus-facing member detail: profile + savings + loans + renteng history. */
export interface MemberDetailDto {
  member: MemberDto;
  savings: MemberSavingDto[];
  loans: LoanDto[];
  rentengHistory: RentengHistoryDto[];
}

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
   * Full member detail for a Pengurus: profile, savings, loans, and
   * tanggung-renteng history (newest first). Unknown id → NotFoundException.
   * A member never involved in a bailout gets `rentengHistory: []`, not an error.
   */
  async detail(id: string): Promise<MemberDetailDto> {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const [savings, loans, rentengEvents] = await Promise.all([
      this.prisma.savingTransaction.findMany({
        where: { memberId: id },
        orderBy: { tanggal: 'desc' },
      }),
      this.prisma.loan.findMany({
        where: { memberId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rentengEvent.findMany({
        where: { memberId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      member: toMemberDto(member),
      savings: savings.map((saving) => ({
        id: saving.id,
        jenis: saving.jenis,
        nominal: toNumber(saving.nominal),
        tanggal: saving.tanggal,
        metode: saving.metode,
        status: saving.status,
        txHash: saving.txHash ?? null,
        createdAt: saving.createdAt,
      })),
      loans: loans.map((loan) => toLoanDto(loan)),
      rentengHistory: rentengEvents.map((event) => ({
        id: event.id,
        memberId: event.memberId,
        loanId: event.loanId,
        event: event.event,
        amount: toNumber(event.amount),
        period: event.period,
        txHash: event.txHash ?? null,
        createdAt: event.createdAt,
      })),
    };
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
