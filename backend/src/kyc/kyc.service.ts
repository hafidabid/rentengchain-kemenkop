import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatusKyc } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit/audit.service';
import { MemberDto, toMemberDto } from '../common/serializers';
import { PrismaService } from '../prisma/prisma.service';
import { OnchainSyncService } from '../web3/onchain-sync.service';
import { WalletService } from '../web3/wallet.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { generateTempPassword } from './password.util';

/** Matches the salt-round cost used by auth for password hashing. */
const BCRYPT_SALT_ROUNDS = 10;

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
  async approve(id: string): Promise<MemberDto & { tempPassword?: string }> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Member not found');
    }

    // Only issue a one-time password when the member has no usable one yet.
    // A re-approve of a member who already has a password does NOT rotate it.
    let tempPassword: string | undefined;
    const approveData: Prisma.MemberUpdateInput = {
      statusKyc: StatusKyc.Approved,
    };
    if (!existing.passwordHash) {
      tempPassword = generateTempPassword();
      approveData.passwordHash = bcrypt.hashSync(
        tempPassword,
        BCRYPT_SALT_ROUNDS,
      );
      approveData.mustChangePassword = true;
    }

    await this.prisma.member.update({
      where: { id },
      data: approveData,
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
    return { ...toMemberDto(member as Record<string, any>), tempPassword };
  }

  /**
   * Pengurus rotates a member's credential: generate a fresh one-time password,
   * store only its hash, flag mustChangePassword, and return the plaintext once.
   * The previous password stops working. 404 if the member does not exist.
   */
  async resetPassword(id: string): Promise<{ tempPassword: string }> {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Member not found');
    }

    const tempPassword = generateTempPassword();
    await this.prisma.member.update({
      where: { id },
      data: {
        passwordHash: bcrypt.hashSync(tempPassword, BCRYPT_SALT_ROUNDS),
        mustChangePassword: true,
      },
    });

    return { tempPassword };
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
