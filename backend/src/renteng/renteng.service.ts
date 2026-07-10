import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StatusCicilan } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit.service';
import { toNumber } from '../common/serializers';
import { PrismaService } from '../prisma/prisma.service';
import { ContractClientService } from '../web3/contract-client.service';
import { LoanDto, toLoanDto } from '../loans/loans.serializer';
import { BailoutDto } from './dto/bailout.dto';
import { RepayTalanganDto } from './dto/repay-talangan.dto';

const DEFAULT_PERIOD = 1;
const DEFAULT_GRACE_PERIOD = 30;

export interface BailoutResult {
  loan: LoanDto;
  group: { id: string; kasSosial: number };
}

/**
 * Flow ③ — tanggung renteng (shared social collateral). When a member misses an
 * installment, a Pengurus triggers a bailout: the group `kasSosial` absorbs the
 * arrears, the loan flips to `DITALANGI`, and the escrow records the missed
 * repayment, applies the social fund, and freezes the group on-chain. Every
 * on-chain write is best-effort via `trySubmit` (never throws), so the off-chain
 * loan/group state and the audit entry always persist even when the relayer or
 * chain is unavailable.
 */
@Injectable()
export class RentengService {
  private readonly logger = new Logger(RentengService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contract: ContractClientService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Pengurus triggers a bailout for a missed installment. On-chain best-effort
   * (recordRepayment onTime=false → applySocialFund → activateRenteng), then the
   * loan becomes DITALANGI and the group `kasSosial` is decremented by the covered
   * installment (clamped at 0). DB state persists even if the chain degrades.
   * Idempotent: a loan already in DITALANGI returns current state unchanged.
   */
  async bailout(
    loanId: string,
    dto: BailoutDto,
    _user?: AuthUser,
  ): Promise<BailoutResult> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { member: { select: { nama: true } } },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const group = await this.prisma.group.findUnique({
      where: { id: loan.groupId },
    });

    // Idempotency: never double-apply a bailout to a loan already talangan.
    if (loan.statusCicilan === StatusCicilan.DITALANGI) {
      return {
        loan: toLoanDto(loan),
        group: {
          id: group?.id ?? loan.groupId,
          kasSosial: toNumber(group?.kasSosial),
        },
      };
    }

    const period = dto.period ?? DEFAULT_PERIOD;
    const gracePeriod = dto.gracePeriod ?? DEFAULT_GRACE_PERIOD;

    // On-chain best-effort: record the missed repayment, cover from the social
    // fund, then activate the renteng freeze. Skip entirely if the loan was
    // never anchored on-chain. Collect the latest confirmed txHash for audit.
    let txHash: string | undefined;
    if (loan.onchainLoanId !== null && loan.onchainLoanId !== undefined) {
      const missed = await this.contract.trySubmit('recordRepayment', [
        loan.onchainLoanId,
        BigInt(period),
        false,
      ]);
      if (missed.ok && missed.txHash) txHash = missed.txHash;

      const social = await this.contract.trySubmit('applySocialFund', [
        loan.onchainLoanId,
        BigInt(period),
      ]);
      if (social.ok && social.txHash) txHash = social.txHash;

      const renteng = await this.contract.trySubmit('activateRenteng', [
        loan.onchainLoanId,
        BigInt(period),
        BigInt(gracePeriod),
      ]);
      if (renteng.ok && renteng.txHash) txHash = renteng.txHash;
    }

    // Off-chain state (persists regardless of on-chain outcome).
    const updatedLoan = await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        statusCicilan: StatusCicilan.DITALANGI,
        txHash: txHash ?? loan.txHash,
      },
    });

    const covered = toNumber(loan.cicilanBulanan);
    const newKasSosial = Math.max(0, toNumber(group?.kasSosial) - covered);
    const updatedGroup = group
      ? await this.prisma.group.update({
          where: { id: group.id },
          data: { kasSosial: newKasSosial },
        })
      : null;

    await this.audit.append(
      'Pengurus',
      'TANGGUNG_RENTENG_TRIGGERED',
      `Talangan for ${loan.member?.nama ?? loan.memberId} (loan ${loanId}) covered ${covered} from kas sosial`,
      txHash,
    );

    return {
      loan: toLoanDto(updatedLoan),
      group: {
        id: updatedGroup?.id ?? loan.groupId,
        kasSosial: updatedGroup ? toNumber(updatedGroup.kasSosial) : newKasSosial,
      },
    };
  }

  /**
   * Pengurus settles a talangan (happy-path only). Best-effort `repayTalangan`
   * on-chain, then the loan flips back to PAID.
   */
  async repayTalangan(
    loanId: string,
    dto: RepayTalanganDto,
    _user?: AuthUser,
  ): Promise<LoanDto> {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');

    let txHash: string | undefined;
    if (loan.onchainLoanId !== null && loan.onchainLoanId !== undefined) {
      const res = await this.contract.trySubmit('repayTalangan', [
        loan.onchainLoanId,
        BigInt(dto.amount),
      ]);
      if (res.ok && res.txHash) txHash = res.txHash;
    }

    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: { statusCicilan: StatusCicilan.PAID, txHash: txHash ?? loan.txHash },
    });

    await this.audit.append(
      'Pengurus',
      'TALANGAN_REPAID',
      `Talangan repaid for loan ${loanId} amount ${dto.amount}`,
      txHash,
    );

    return toLoanDto(updated);
  }
}
