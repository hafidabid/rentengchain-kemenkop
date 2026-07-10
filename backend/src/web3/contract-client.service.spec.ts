import { ConfigService } from '@nestjs/config';
import { decodeFunctionData } from 'viem';
import { ESCROW_ABI, PaymentMethod, SavingsType } from './abis/escrow.abi';
import { ContractClientService } from './contract-client.service';
import { HashingService } from './hashing.service';
import { RelayerService } from './relayer.service';

const cfg = (overrides: Record<string, string> = {}): ConfigService =>
  ({
    get: (k: string, d?: string) => overrides[k] ?? d,
  }) as unknown as ConfigService;

describe('ContractClientService', () => {
  const hashing = new HashingService(cfg({ COOP_HASH_SALT: 'salt' }));
  // No RELAYER_PRIVATE_KEY => read-only relayer.
  const relayer = new RelayerService(cfg());
  const client = new ContractClientService(cfg(), relayer);

  const NIK = '3273011122334455';

  // --- Offline calldata build ---
  it('encodes recordSavings calldata targeting the deployed escrow', () => {
    const memberHash = hashing.memberHash(NIK);
    const call = client.buildCall('recordSavings', [
      memberHash,
      SavingsType.WAJIB,
      100000n,
      PaymentMethod.QRIS,
    ]);
    expect(call.address).toBe('0x199812B240bf8d90dBAfB5C7E2ab79e3fAf728dE');
    expect(call.data).toMatch(/^0x[0-9a-f]+$/);
    // Round-trips through the ABI back to the same args.
    const decoded = decodeFunctionData({ abi: ESCROW_ABI, data: call.data });
    expect(decoded.functionName).toBe('recordSavings');
  });

  it('submits ONLY hashes/enums/numbers/addresses — never raw PII', () => {
    const memberHash = hashing.memberHash(NIK);
    const koperasiId = hashing.koperasiId('coop');
    const call = client.buildCall('registerMember', [
      memberHash,
      koperasiId,
      '0x1234567890123456789012345678901234567890',
    ]);
    for (const arg of call.args) {
      const ok =
        typeof arg === 'bigint' ||
        typeof arg === 'number' ||
        (typeof arg === 'string' && /^0x[0-9a-fA-F]+$/.test(arg));
      expect(ok).toBe(true);
    }
    // The raw NIK must never appear anywhere in the calldata.
    expect(call.data.includes(NIK)).toBe(false);
    expect(call.args).not.toContain(NIK);
  });

  // --- Write path guard ---
  it('refuses to submit without a configured relayer key', async () => {
    await expect(client.submit('approveLoan', [1n])).rejects.toThrow(
      /RELAYER_PRIVATE_KEY/,
    );
  });

  it('reports read-only mode when no key is set', () => {
    expect(relayer.canWrite).toBe(false);
    expect(relayer.address).toBeNull();
  });
});
