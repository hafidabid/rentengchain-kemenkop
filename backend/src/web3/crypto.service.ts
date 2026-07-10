import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * Env-encryptable storage for custodial private keys. When COOP_KEY_ENC_SECRET
 * is set, keys are wrapped with AES-256-GCM; otherwise they are stored with a
 * `plain:` marker so the column can be transparently wrapped later without a
 * schema change (per claude0.md §4 — accepted for this phase).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const secret = config.get<string>('COOP_KEY_ENC_SECRET');
    this.key = secret
      ? scryptSync(secret, 'rantairenteng-key-salt', 32)
      : null;
  }

  encrypt(plaintext: string): string {
    if (!this.key) return `plain:${plaintext}`;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  decrypt(stored: string): string {
    if (stored.startsWith('plain:')) return stored.slice('plain:'.length);
    if (!this.key) {
      throw new Error('COOP_KEY_ENC_SECRET required to decrypt an encrypted key');
    }
    const [, ivHex, tagHex, dataHex] = stored.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
