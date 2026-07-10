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
  // No keys => both signers absent (read-only).
  const relayer = new RelayerService(cfg());
  const client = new ContractClientService(cfg(), relayer);

  const NIK = '3273011122334455';

  // --- Role routing ---
  it('maps methods to the correct signing role', () => {
    expect(client.roleFor('recordSavings')).toBe('RELAYER');
    expect(client.roleFor('createLoan')).toBe('RELAYER');
    expect(client.roleFor('registerMember')).toBe('KOPERASI');
    expect(client.roleFor('approveLoan')).toBe('KOPERASI');
    expect(client.roleFor('resolveAppeal')).toBe('KOPERASI');
  });

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
    expect(call.data.includes(NIK)).toBe(false);
    expect(call.args).not.toContain(NIK);
  });

  // --- Write path guards (role-aware) ---
  it('submit() a RELAYER method throws about RELAYER_PRIVATE_KEY when unset', async () => {
    await expect(client.submit('recordSavings', [])).rejects.toThrow(
      /RELAYER_PRIVATE_KEY/,
    );
  });

  it('submit() a KOPERASI method throws about ADMIN_PRIVATE_KEY when unset', async () => {
    await expect(client.submit('approveLoan', [1n])).rejects.toThrow(
      /ADMIN_PRIVATE_KEY/,
    );
  });

  it('trySubmit() degrades gracefully to { ok:false } instead of throwing', async () => {
    const res = await client.trySubmit('registerMember', []);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ADMIN_PRIVATE_KEY/);
  });

  it('reports which methods are submittable given configured signers', () => {
    expect(client.canSubmit('recordSavings')).toBe(false);
    expect(client.canSubmit('approveLoan')).toBe(false);
    expect(relayer.canWrite('RELAYER')).toBe(false);
    expect(relayer.relayerAddress).toBeNull();
    expect(relayer.adminAddress).toBeNull();
  });
});
