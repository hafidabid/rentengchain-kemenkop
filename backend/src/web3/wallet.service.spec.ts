import { getAddress, isAddress } from 'viem';
import { CryptoService } from './crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

const plainCrypto = {
  encrypt: (s: string) => `plain:${s}`,
  decrypt: (s: string) => s.replace(/^plain:/, ''),
} as unknown as CryptoService;

describe('WalletService', () => {
  let prisma: {
    member: { findUnique: jest.Mock; update: jest.Mock };
  };
  let svc: WalletService;

  beforeEach(() => {
    prisma = { member: { findUnique: jest.fn(), update: jest.fn() } };
    svc = new WalletService(prisma as unknown as PrismaService, plainCrypto);
  });

  // --- Positive ---
  it('generates a valid checksummed address with a stored key', () => {
    const w = svc.generate();
    expect(isAddress(w.address)).toBe(true);
    expect(w.address).toBe(getAddress(w.address)); // checksummed
    expect(w.encryptedPrivkey.startsWith('plain:0x')).toBe(true);
  });

  it('generates a unique wallet each call', () => {
    expect(svc.generate().address).not.toBe(svc.generate().address);
  });

  it('ensureWallet mints and persists when member has none', async () => {
    prisma.member.findUnique.mockResolvedValue({ id: 'm1', walletAddress: null });
    prisma.member.update.mockResolvedValue({});
    const addr = await svc.ensureWallet('m1');
    expect(isAddress(addr)).toBe(true);
    expect(prisma.member.update).toHaveBeenCalledTimes(1);
    const data = prisma.member.update.mock.calls[0][0].data;
    expect(data.walletAddress).toBe(addr);
    expect(data.encryptedPrivkey).toContain('plain:0x');
  });

  // --- Idempotency / edge ---
  it('ensureWallet is idempotent when a wallet already exists', async () => {
    prisma.member.findUnique.mockResolvedValue({
      id: 'm1',
      walletAddress: '0x1234567890123456789012345678901234567890',
    });
    const addr = await svc.ensureWallet('m1');
    expect(addr).toBe('0x1234567890123456789012345678901234567890');
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('ensureWallet throws for an unknown member', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(svc.ensureWallet('nope')).rejects.toThrow('not found');
  });
});
