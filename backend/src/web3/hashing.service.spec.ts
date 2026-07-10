import { ConfigService } from '@nestjs/config';
import { HashingService } from './hashing.service';

const cfg = (salt: string): ConfigService =>
  ({ get: (_k: string, d?: string) => salt ?? d }) as unknown as ConfigService;

describe('HashingService', () => {
  const svc = new HashingService(cfg('coop-secret-salt'));
  const NIK = '3273011122334455';

  // --- Positive ---
  it('produces a bytes32 hex hash', () => {
    expect(svc.memberHash(NIK)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(svc.memberHash(NIK)).toBe(svc.memberHash(NIK));
  });

  it('domain-separates: same value hashes differently per field', () => {
    expect(svc.memberHash('x')).not.toBe(svc.groupId('x'));
    expect(svc.reasonHash('x')).not.toBe(svc.inviteCodeHash('x'));
  });

  it('paramsHash accepts objects and strings deterministically', () => {
    expect(svc.paramsHash({ a: 1 })).toBe(svc.paramsHash({ a: 1 }));
    expect(svc.paramsHash('doc')).toMatch(/^0x[0-9a-f]{64}$/);
  });

  // --- Privacy / edge ---
  it('never leaks the raw PII in the hash', () => {
    const h = svc.memberHash(NIK);
    expect(h.includes(NIK)).toBe(false);
  });

  it('different cooperative salts yield different hashes', () => {
    const a = new HashingService(cfg('salt-A'));
    const b = new HashingService(cfg('salt-B'));
    expect(a.memberHash(NIK)).not.toBe(b.memberHash(NIK));
  });
});
