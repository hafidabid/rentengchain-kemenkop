import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { keccak256, stringToHex, type Hex } from 'viem';

/**
 * Salted, domain-separated hashing for on-chain identifiers. The chain only ever
 * receives these bytes32 hashes — never raw NIK, names, invite codes, or appeal text.
 * A per-cooperative secret salt (COOP_HASH_SALT) makes the small NIK search space
 * non-reversible by enumeration.
 */
@Injectable()
export class HashingService {
  private readonly salt: string;

  constructor(config: ConfigService) {
    this.salt = config.get<string>('COOP_HASH_SALT', 'dev-only-coop-salt');
  }

  private hash(domain: string, value: string): Hex {
    return keccak256(stringToHex(`${this.salt}:${domain}:${value}`));
  }

  /** Stable on-chain identity for a member, from their NIK. */
  memberHash(nik: string): Hex {
    return this.hash('member', nik);
  }

  /** Cooperative id. */
  koperasiId(seed: string): Hex {
    return this.hash('koperasi', seed);
  }

  /** Group id, from a stable group seed (e.g. the DB group id). */
  groupId(seed: string): Hex {
    return this.hash('group', seed);
  }

  /** Invite-code hash. */
  inviteCodeHash(code: string): Hex {
    return this.hash('invite', code);
  }

  /** Appeal reason hash — never submit the raw sanggah text. */
  reasonHash(text: string): Hex {
    return this.hash('reason', text);
  }

  /** Screening params/consent document hash. Accepts an object or string. */
  paramsHash(params: unknown): Hex {
    const value =
      typeof params === 'string' ? params : JSON.stringify(params ?? {});
    return this.hash('params', value);
  }
}
