import { Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from './crypto.service';

export interface GeneratedWallet {
  address: string;
  encryptedPrivkey: string;
}

/**
 * Custodial wallet: one EVM keypair per member = their on-chain identity.
 * The address goes on the member; the key is stored env-encryptable and never
 * returned by any API.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Generate a fresh keypair. Pure — persists nothing. */
  generate(): GeneratedWallet {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    return {
      address: getAddress(account.address),
      encryptedPrivkey: this.crypto.encrypt(privateKey),
    };
  }

  /**
   * Ensure a member has a wallet. Idempotent: if the member already has an
   * address, keep it and generate nothing new. Returns the member's address.
   */
  async ensureWallet(memberId: string): Promise<string> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, walletAddress: true },
    });
    if (!member) {
      throw new Error(`Member ${memberId} not found`);
    }
    if (member.walletAddress) {
      return member.walletAddress;
    }
    const wallet = this.generate();
    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        walletAddress: wallet.address,
        encryptedPrivkey: wallet.encryptedPrivkey,
      },
    });
    return wallet.address;
  }
}
