import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAddress, type Hex } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { ContractClientService, TrySubmitResult } from './contract-client.service';
import { HashingService } from './hashing.service';

/**
 * Bridges DB entities to the escrow's on-chain identity model. Registration is
 * KOPERASI_ROLE (admin key); once a member/group is registered on-chain, the
 * RELAYER methods (savings, loans, repayments) become callable. All methods
 * degrade gracefully when a signer is missing or a call reverts.
 */
@Injectable()
export class OnchainSyncService {
  private readonly logger = new Logger(OnchainSyncService.name);
  private readonly coopSeed: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contract: ContractClientService,
    private readonly hashing: HashingService,
  ) {
    this.coopSeed = config.get<string>('COOP_ID_SEED', 'rantairenteng-mekar-sari');
  }

  koperasiId(): Hex {
    return this.hashing.koperasiId(this.coopSeed);
  }
  memberHashFor(nik: string): Hex {
    return this.hashing.memberHash(nik);
  }
  groupIdFor(dbGroupId: string): Hex {
    return this.hashing.groupId(dbGroupId);
  }

  /** Register a member on-chain (idempotent). Marks onchainRegistered on success. */
  async registerMember(memberId: string): Promise<TrySubmitResult> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return { ok: false, error: 'member not found' };
    if (member.onchainRegistered) return { ok: true, status: 'success' };
    if (!member.walletAddress) return { ok: false, error: 'member has no wallet yet' };

    const res = await this.contract.trySubmit('registerMember', [
      this.memberHashFor(member.nik),
      this.koperasiId(),
      getAddress(member.walletAddress),
    ]);
    if (res.ok) {
      await this.prisma.member.update({
        where: { id: memberId },
        data: { onchainRegistered: true },
      });
    }
    return res;
  }

  /** Register a group on-chain (chair must already be registered). */
  async registerGroup(groupId: string): Promise<TrySubmitResult> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return { ok: false, error: 'group not found' };
    if (group.onchainRegistered) return { ok: true, status: 'success' };
    const chair = group.ketuaId
      ? await this.prisma.member.findUnique({ where: { id: group.ketuaId } })
      : null;
    if (!chair) return { ok: false, error: 'group has no registered chair' };

    const res = await this.contract.trySubmit('registerGroup', [
      this.groupIdFor(group.id),
      this.koperasiId(),
      this.memberHashFor(chair.nik),
      BigInt(Math.round(Number(group.plafonMaks))),
      this.hashing.inviteCodeHash(group.kodeUndangan),
    ]);
    if (res.ok) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: { onchainRegistered: true },
      });
    }
    return res;
  }

  /** Join a member to a group on-chain (member + group must be registered). */
  async joinGroup(memberId: string, groupId: string): Promise<TrySubmitResult> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!member || !group) return { ok: false, error: 'member/group not found' };
    return this.contract.trySubmit('joinGroup', [
      this.groupIdFor(group.id),
      this.memberHashFor(member.nik),
      this.hashing.inviteCodeHash(group.kodeUndangan),
    ]);
  }

  /**
   * One-shot bootstrap for the demo: register every approved member, then each
   * group and its non-chair memberships, so RELAYER flows work live. Idempotent
   * and safe to run repeatedly.
   */
  async bootstrapSeeded(): Promise<{ steps: string[] }> {
    const steps: string[] = [];
    const members = await this.prisma.member.findMany({
      where: { statusKyc: 'Approved', walletAddress: { not: null } },
    });
    for (const m of members) {
      const r = await this.registerMember(m.id);
      steps.push(`registerMember ${m.nama}: ${r.ok ? r.txHash ?? 'ok' : r.error}`);
    }
    const groups = await this.prisma.group.findMany({
      include: { members: true },
    });
    for (const g of groups) {
      const gr = await this.registerGroup(g.id);
      steps.push(`registerGroup ${g.nama}: ${gr.ok ? gr.txHash ?? 'ok' : gr.error}`);
      for (const mg of g.members) {
        if (mg.memberId === g.ketuaId) continue; // chair auto-joined
        const jr = await this.joinGroup(mg.memberId, g.id);
        steps.push(`joinGroup ${mg.memberId}: ${jr.ok ? jr.txHash ?? 'ok' : jr.error}`);
      }
    }
    this.logger.log(`bootstrapSeeded: ${steps.length} steps`);
    return { steps };
  }
}
