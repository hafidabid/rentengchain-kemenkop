import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const cfg = (secret?: string): ConfigService =>
  ({ get: (_k: string) => secret }) as unknown as ConfigService;

const SAMPLE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

describe('CryptoService', () => {
  // --- With an encryption secret ---
  describe('encrypted mode', () => {
    const svc = new CryptoService(cfg('a-strong-env-secret'));

    it('round-trips encrypt -> decrypt', () => {
      const stored = svc.encrypt(SAMPLE_KEY);
      expect(stored.startsWith('enc:')).toBe(true);
      expect(stored).not.toContain(SAMPLE_KEY);
      expect(svc.decrypt(stored)).toBe(SAMPLE_KEY);
    });

    it('produces a fresh IV each time (ciphertexts differ)', () => {
      expect(svc.encrypt(SAMPLE_KEY)).not.toBe(svc.encrypt(SAMPLE_KEY));
    });
  });

  // --- Without a secret (env-encryptable passthrough) ---
  describe('plain mode', () => {
    const svc = new CryptoService(cfg(undefined));

    it('stores with a plain: marker and round-trips', () => {
      const stored = svc.encrypt(SAMPLE_KEY);
      expect(stored).toBe(`plain:${SAMPLE_KEY}`);
      expect(svc.decrypt(stored)).toBe(SAMPLE_KEY);
    });

    it('cannot decrypt an encrypted blob without the secret', () => {
      const enc = new CryptoService(cfg('secret')).encrypt(SAMPLE_KEY);
      expect(() => svc.decrypt(enc)).toThrow();
    });
  });
});
