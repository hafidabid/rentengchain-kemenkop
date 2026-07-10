import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SavingJenis, SavingStatus } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentMethod,
  SavingsType,
} from '../web3/abis/escrow.abi';
import { ContractClientService } from '../web3/contract-client.service';
import { HashingService } from '../web3/hashing.service';
import { CreateSavingDto } from './dto/create-saving.dto';
import { SavingDto, toSavingDto } from './savings.serializer';

/** Maps each simpanan jenis to its balance column on the member record. */
const BALANCE_COLUMN: Record<
  SavingJenis,
  'simpananPokok' | 'simpananWajib' | 'simpananSukarela'
> = {
  [SavingJenis.Pokok]: 'simpananPokok',
  [SavingJenis.Wajib]: 'simpananWajib',
  [SavingJenis.Sukarela]: 'simpananSukarela',
};

/**
 * Flow ④: savings + on-chain audit trail. A member records a simpanan with a
 * simulated QRIS confirmation (the request itself confirms the payment); the
 * transaction is persisted PAID, the member's matching balance is incremented,
 * and — best-effort — an accounting anchor is written on-chain via recordSavings.
 * Off-chain state and the audit entry persist even if the chain degrades.
 */
@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly contract: ContractClientService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private explorerBaseUrl(): string {
    return this.config.get<string>(
      'EXPLORER_BASE_URL',
      'https://sepolia.basescan.org',
    );
  }

  /**
   * Record a simpanan and anchor it on-chain. Unknown memberId → 404. The saving
   * row (PAID) and the balance increment are committed before the on-chain call,
   * so a chain failure leaves them intact with a null txHash.
   */
  async create(dto: CreateSavingDto): Promise<SavingDto> {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const saving = await this.prisma.savingTransaction.create({
      data: {
        memberId: dto.memberId,
        jenis: dto.jenis,
        nominal: dto.nominal,
        metode: dto.metode ?? 'QRIS',
        status: SavingStatus.PAID,
      },
    });

    await this.prisma.member.update({
      where: { id: dto.memberId },
      data: { [BALANCE_COLUMN[dto.jenis]]: { increment: dto.nominal } },
    });

    const savingsType =
      SavingsType[dto.jenis.toUpperCase() as keyof typeof SavingsType];
    const result = await this.contract.trySubmit('recordSavings', [
      this.hashing.memberHash(member.nik),
      savingsType,
      BigInt(dto.nominal),
      PaymentMethod.QRIS,
    ]);

    let txHash: string | null = null;
    if (result.ok && result.txHash) {
      txHash = result.txHash;
      await this.prisma.savingTransaction.update({
        where: { id: saving.id },
        data: { txHash },
      });
    }

    await this.audit.append(
      member.nama,
      'SIMPANAN_PAID',
      `Simpanan ${dto.jenis} sebesar ${dto.nominal}`,
      txHash ?? undefined,
    );

    return toSavingDto({ ...saving, txHash }, this.explorerBaseUrl());
  }

  /** A member's savings, newest-first, each mapped to a DTO with a derived txLink. */
  async findByMember(memberId: string): Promise<SavingDto[]> {
    const explorerBaseUrl = this.explorerBaseUrl();
    const rows = await this.prisma.savingTransaction.findMany({
      where: { memberId },
      orderBy: { tanggal: 'desc' },
    });
    return rows.map((row) => toSavingDto(row, explorerBaseUrl));
  }
}
