import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ContractClientService } from './contract-client.service';
import { HashingService } from './hashing.service';
import { OnchainSyncService } from './onchain-sync.service';

const cfg = (o: Record<string, string> = {}): ConfigService =>
  ({ get: (k: string, d?: string) => o[k] ?? d }) as unknown as ConfigService;

describe('OnchainSyncService', () => {
  let prisma: {
    member: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    group: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  };
  let contract: { trySubmit: jest.Mock };
  let svc: OnchainSyncService;

  const hashing = new HashingService(cfg({ COOP_HASH_SALT: 'salt' }));
  const member = {
    id: 'm1',
    nik: '3273011122334455',
    nama: 'Ira',
    walletAddress: '0x1234567890123456789012345678901234567890',
    onchainRegistered: false,
  };

  beforeEach(() => {
    prisma = {
      member: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      group: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };
    contract = { trySubmit: jest.fn() };
    svc = new OnchainSyncService(
      cfg({ COOP_ID_SEED: 'coop' }),
      prisma as unknown as PrismaService,
      contract as unknown as ContractClientService,
      hashing,
    );
  });

  // --- Positive ---
  it('registers a member and marks onchainRegistered on success', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    contract.trySubmit.mockResolvedValue({ ok: true, txHash: '0xabc' });
    const res = await svc.registerMember('m1');
    expect(res.ok).toBe(true);
    expect(contract.trySubmit).toHaveBeenCalledWith(
      'registerMember',
      expect.arrayContaining([hashing.memberHash(member.nik)]),
    );
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { onchainRegistered: true },
    });
  });

  // --- Idempotency / edge ---
  it('is idempotent when already registered (no tx)', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, onchainRegistered: true });
    const res = await svc.registerMember('m1');
    expect(res.ok).toBe(true);
    expect(contract.trySubmit).not.toHaveBeenCalled();
  });

  it('skips a member without a wallet', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, walletAddress: null });
    const res = await svc.registerMember('m1');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/wallet/);
  });

  it('does NOT mark registered when the on-chain call fails (degrade)', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    contract.trySubmit.mockResolvedValue({ ok: false, error: 'ADMIN_PRIVATE_KEY' });
    const res = await svc.registerMember('m1');
    expect(res.ok).toBe(false);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('returns not-found for an unknown member', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    const res = await svc.registerMember('nope');
    expect(res.ok).toBe(false);
  });

  it('computes a stable koperasiId and memberHash', () => {
    expect(svc.koperasiId()).toMatch(/^0x[0-9a-f]{64}$/);
    expect(svc.memberHashFor(member.nik)).toBe(hashing.memberHash(member.nik));
  });
});
