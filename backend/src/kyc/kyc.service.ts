import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatusKyc } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';
import { MemberDto, toMemberDto } from '../common/serializers';
import { PrismaService } from '../prisma/prisma.service';
import { OnchainSyncService } from '../web3/onchain-sync.service';
import { WalletService } from '../web3/wallet.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';

/**
 * Flow ①: onboarding + wallet mint. Orchestrates member-registry, custodial-
 * wallet, on-chain registration, and audit-log for the KYC decision path.
 */
@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly onchainSync: OnchainSyncService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Record a prospective member from a KYC submission. Persisted as
   * statusKyc=Requested, role=Anggota, skorKeanggotaan=100, walletAddress null.
   * A duplicate NIK is rejected with a 409.
   */
  async submit(dto: SubmitKycDto): Promise<MemberDto> {
    try {
      const member = await this.prisma.member.create({
        data: {
          nama: dto.nama,
          nik: dto.nik,
          noHp: dto.noHp,
          alamat: dto.alamat,
          pekerjaan: dto.pekerjaan,
          peran: dto.peran,
          ktpUrl: dto.ktpUrl ?? null,
          statusKyc: StatusKyc.Requested,
          role: Role.Anggota,
          skorKeanggotaan: 100,
        },
      });
      return toMemberDto(member);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('NIK already registered');
      }
      throw error;
    }
  }

  /**
   * Pengurus approves a member: set Approved, mint a custodial wallet (idempotent),
   * anchor registration on-chain (best-effort), and audit with the resulting
   * txHash. Re-approving an already-Approved member keeps the existing wallet.
   */
  async approve(id: string): Promise<MemberDto> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.member.update({
      where: { id },
      data: { statusKyc: StatusKyc.Approved },
    });

    const walletAddress = await this.walletService.ensureWallet(id);
    const registration = await this.onchainSync.registerMember(id);

    await this.audit.append(
      'Pengurus',
      'KYC_APPROVED',
      `Menyetujui KYC ${existing.nama}, wallet ${walletAddress}`,
      registration.txHash,
    );

    const member = await this.prisma.member.findUnique({ where: { id } });
    return toMemberDto(member as Record<string, any>);
  }

  /**
   * Pengurus rejects a member: set Rejected, audit, mint no wallet.
   */
  async reject(id: string): Promise<MemberDto> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Member not found');
    }

    const member = await this.prisma.member.update({
      where: { id },
      data: { statusKyc: StatusKyc.Rejected },
    });

    await this.audit.append(
      'Pengurus',
      'KYC_REJECTED',
      `Menolak KYC ${existing.nama}`,
    );

    return toMemberDto(member);
  }
}
