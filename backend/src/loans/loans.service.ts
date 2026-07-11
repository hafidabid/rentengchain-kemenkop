import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoanStatus, StatusCicilan } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { toNumber } from '../common/serializers';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContractClientService } from '../web3/contract-client.service';
import { HashingService } from '../web3/hashing.service';
import { OnchainSyncService } from '../web3/onchain-sync.service';
import { AIFlag } from '../web3/abis/escrow.abi';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { ApproveDto } from './dto/approve.dto';
import { RejectDto } from './dto/reject.dto';
import { SanggahDto } from './dto/sanggah.dto';
import { GeminiService } from './gemini.service';
import {
  LoanDecisionDto,
  LoanDto,
  LoanDtoExtra,
  toLoanDecisionDto,
  toLoanDto,
} from './loans.serializer';

const SCREENING_MODEL = 'gemini-2.0-flash';
const THIRTY_DAYS_SECONDS = 30 * 24 * 3600;

/**
 * Flow ② — the loan lifecycle plus the AI risk flag and appeal (sanggah). Every
 * on-chain write is best-effort via `trySubmit` (never throws), so the off-chain
 * loan/appeal state and the audit entry always persist even when the relayer or
 * chain is unavailable.
 */
@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly contract: ContractClientService,
    private readonly onchain: OnchainSyncService,
    private readonly hashing: HashingService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private explorerBaseUrl(): string {
    return this.config.get<string>(
      'EXPLORER_BASE_URL',
      'https://sepolia.basescan.org',
    );
  }

  private serialize(loan: Record<string, any>, extra: LoanDtoExtra = {}): LoanDto {
    return toLoanDto(loan, {
      explorerBaseUrl: this.explorerBaseUrl(),
      ...extra,
    });
  }

  /** Member applies for a group-bound loan: screen → persist → anchor on-chain. */
  async apply(dto: ApplyLoanDto, user?: AuthUser): Promise<LoanDto> {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
    });
    if (!group) throw new NotFoundException('Group not found');

    const cicilanBulanan =
      dto.cicilanBulanan ?? Math.round(dto.nominal / dto.tenor);

    const screening = await this.gemini.screen({
      skorKeanggotaan: member.skorKeanggotaan,
      isDorman: member.isDorman,
      simpananPokok: toNumber(member.simpananPokok),
      simpananWajib: toNumber(member.simpananWajib),
      simpananSukarela: toNumber(member.simpananSukarela),
      kehadiranRate: toNumber(group.kehadiranRate),
      tujuan: dto.tujuan,
      nominal: dto.nominal,
    });

    let loan = await this.prisma.loan.create({
      data: {
        memberId: member.id,
        groupId: group.id,
        nominal: dto.nominal,
        tujuan: dto.tujuan,
        tenor: dto.tenor,
        status: LoanStatus.Diajukan,
        statusCicilan: StatusCicilan.UNPAID,
        sisaCicilan: dto.tenor,
        cicilanBulanan,
        jadwalCicilan: group.jadwalPertemuan,
        skorAi: screening.skorAi,
        flagAi: screening.flagAi,
        flagAlasan: screening.flagAlasan,
      },
    });

    // On-chain best-effort. Read the next id the escrow will assign so we can
    // persist onchainLoanId; failure here must not block the off-chain loan.
    let nextId: bigint | null = null;
    try {
      nextId = await this.contract.readNextLoanId();
    } catch (err) {
      this.logger.warn(
        `readNextLoanId failed; loan ${loan.id} stays off-chain-only: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      nextId = null;
    }

    const paramsHash = this.hashing.paramsHash({
      model: SCREENING_MODEL,
      skorAi: screening.skorAi,
      flagAi: screening.flagAi,
    });
    const firstDueDate = Math.floor(Date.now() / 1000) + THIRTY_DAYS_SECONDS;

    const createRes = await this.contract.trySubmit('createLoan', [
      this.onchain.groupIdFor(group.id),
      this.onchain.memberHashFor(member.nik),
      BigInt(dto.nominal),
      BigInt(dto.tenor),
      BigInt(cicilanBulanan),
      screening.skorAi,
      AIFlag[screening.flagAi],
      paramsHash,
      BigInt(firstDueDate),
    ]);

    if (createRes.ok && nextId !== null) {
      loan = await this.prisma.loan.update({
        where: { id: loan.id },
        data: { onchainLoanId: nextId, txHash: createRes.txHash ?? null },
      });
      // Tracking anchor: only skorAi, the flag enum, and the params hash.
      await this.contract.trySubmit('recordScreening', [
        nextId,
        screening.skorAi,
        AIFlag[screening.flagAi],
        paramsHash,
      ]);
    }

    await this.audit.append(
      user?.userId ?? member.id,
      'LOAN_APPLIED',
      `Loan ${loan.id} for ${member.nama} (${dto.tujuan}) flagged ${screening.flagAi} score ${screening.skorAi}`,
      createRes.txHash,
    );

    return this.serialize(loan, { memberNama: member.nama, groupNama: group.nama });
  }

  /** Member files an appeal on their loan. Only a salted reasonHash goes on-chain. */
  async sanggah(id: string, dto: SanggahDto, user?: AuthUser): Promise<LoanDto> {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');

    let updated = await this.prisma.loan.update({
      where: { id },
      data: { isSanggah: true, sanggahAlasan: dto.alasan },
    });

    let txHash: string | undefined;
    if (loan.onchainLoanId !== null && loan.onchainLoanId !== undefined) {
      const res = await this.contract.trySubmit('fileAppeal', [
        loan.onchainLoanId,
        this.hashing.reasonHash(dto.alasan),
      ]);
      if (res.ok && res.txHash) {
        txHash = res.txHash;
        updated = await this.prisma.loan.update({
          where: { id },
          data: { txHash: res.txHash },
        });
      }
    }

    await this.audit.append(
      user?.userId ?? loan.memberId,
      'LOAN_SANGGAH',
      `Appeal filed on loan ${id}`,
      txHash,
    );

    return this.serialize(updated);
  }

  /**
   * Persist a decision into the loan's immutable history. When a `note` is given
   * it is also stored on the loan (`catatanPengurus`) so the owning anggota can
   * read it; a decision without a note leaves the existing note untouched.
   */
  private async recordDecision(
    loanId: string,
    isSanggah: boolean,
    mainDecision: string,
    sanggahDecision: string,
    note?: string,
  ): Promise<void> {
    await this.prisma.loanDecision.create({
      data: { loanId, decision: mainDecision, note, aktor: 'Pengurus' },
    });
    if (isSanggah) {
      await this.prisma.loanDecision.create({
        data: { loanId, decision: sanggahDecision, note, aktor: 'Pengurus' },
      });
    }
  }

  /** Pengurus approves a loan; resolves the appeal favourably if one was filed. */
  async approve(
    id: string,
    dto: ApproveDto = {},
    user?: AuthUser,
  ): Promise<LoanDto> {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');

    const note = dto?.note;
    const data: Record<string, any> = { status: LoanStatus.Disetujui };
    if (note !== undefined && note !== null) data.catatanPengurus = note;

    const updated = await this.prisma.loan.update({
      where: { id },
      data,
    });

    await this.recordDecision(
      id,
      loan.isSanggah,
      'Disetujui',
      'SanggahDiterima',
      note,
    );

    let txHash: string | undefined;
    if (loan.onchainLoanId !== null && loan.onchainLoanId !== undefined) {
      const res = await this.contract.trySubmit('approveLoan', [
        loan.onchainLoanId,
      ]);
      if (res.ok && res.txHash) txHash = res.txHash;
      if (loan.isSanggah) {
        await this.contract.trySubmit('resolveAppeal', [
          loan.onchainLoanId,
          true,
        ]);
      }
    }

    await this.audit.append(
      user?.userId ?? 'pengurus',
      'LOAN_APPROVED',
      `Loan ${id} approved${loan.isSanggah ? ' (appeal accepted)' : ''}`,
      txHash,
    );

    return this.serialize(updated);
  }

  /** Pengurus rejects/holds a loan (status → Ditunda); resolves any appeal against. */
  async reject(id: string, dto: RejectDto, user?: AuthUser): Promise<LoanDto> {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');

    const note = dto?.note;
    const data: Record<string, any> = { status: LoanStatus.Ditunda };
    if (note !== undefined && note !== null) data.catatanPengurus = note;

    const updated = await this.prisma.loan.update({
      where: { id },
      data,
    });

    await this.recordDecision(
      id,
      loan.isSanggah,
      'Ditunda',
      'SanggahDitolak',
      note,
    );

    let txHash: string | undefined;
    if (loan.onchainLoanId !== null && loan.onchainLoanId !== undefined) {
      const res = await this.contract.trySubmit('deferLoan', [
        loan.onchainLoanId,
      ]);
      if (res.ok && res.txHash) txHash = res.txHash;
      if (loan.isSanggah) {
        await this.contract.trySubmit('resolveAppeal', [
          loan.onchainLoanId,
          false,
        ]);
      }
    }

    await this.audit.append(
      user?.userId ?? 'pengurus',
      'LOAN_REJECTED',
      `Loan ${id} held/deferred${dto.reason ? `: ${dto.reason}` : ''}`,
      txHash,
    );

    return this.serialize(updated);
  }

  /** Pengurus review list: loans with member + group names, AI fields, appeal info. */
  async findAll(): Promise<LoanDto[]> {
    const loans = await this.prisma.loan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { nama: true } },
        group: { select: { nama: true } },
      },
    });
    return loans.map((loan) =>
      this.serialize(loan, {
        memberNama: loan.member?.nama,
        groupNama: loan.group?.nama,
      }),
    );
  }

  async findOne(id: string): Promise<LoanDto> {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        member: { select: { nama: true } },
        group: { select: { nama: true } },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return this.serialize(loan, {
      memberNama: loan.member?.nama,
      groupNama: loan.group?.nama,
    });
  }

  /** Pengurus decision timeline for a loan, newest first. */
  async findDecisions(id: string): Promise<LoanDecisionDto[]> {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');

    const decisions = await this.prisma.loanDecision.findMany({
      where: { loanId: id },
      orderBy: { createdAt: 'desc' },
    });
    return decisions.map(toLoanDecisionDto);
  }
}
