import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/** On-chain role a method requires. RELAYER methods sign with the relayer key;
 * KOPERASI methods (register/approve/resolve) sign with the admin key. */
export type OnchainRole = 'RELAYER' | 'KOPERASI';

/** Thrown when the signer required for a role is not configured. Flows catch
 * this and degrade gracefully (persist off-chain + audit, no tx). */
export class OnchainUnavailableError extends Error {
  constructor(role: OnchainRole) {
    super(
      `No signer for ${role}: set ${
        role === 'RELAYER' ? 'RELAYER_PRIVATE_KEY' : 'ADMIN_PRIVATE_KEY'
      } (funded on Base Sepolia).`,
    );
    this.name = 'OnchainUnavailableError';
  }
}

interface Signer {
  walletClient: WalletClient;
  account: Account;
}

/**
 * Owns the viem clients and the two signing keys. The RELAYER key
 * (RELAYER_ROLE) records savings/repayments/loans; the ADMIN key (KOPERASI_ROLE)
 * registers members/groups and approves/resolves. Members never hold keys or gas.
 * The public client is always available (read-only) with no secret.
 */
@Injectable()
export class RelayerService {
  private readonly logger = new Logger(RelayerService.name);
  private readonly publicClient: PublicClient;
  private readonly relayerSigner: Signer | null;
  private readonly adminSigner: Signer | null;
  readonly rpcUrl: string;

  constructor(config: ConfigService) {
    this.rpcUrl = config.get<string>('BASE_RPC_URL', 'https://sepolia.base.org');
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(this.rpcUrl),
    }) as PublicClient;

    this.relayerSigner = this.buildSigner(
      config.get<string>('RELAYER_PRIVATE_KEY'),
      'RELAYER_PRIVATE_KEY',
    );
    this.adminSigner = this.buildSigner(
      config.get<string>('ADMIN_PRIVATE_KEY'),
      'ADMIN_PRIVATE_KEY',
    );
  }

  private buildSigner(pk: string | undefined, label: string): Signer | null {
    if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      this.logger.warn(`${label} not configured — related on-chain writes disabled.`);
      return null;
    }
    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(this.rpcUrl),
    }) as WalletClient;
    this.logger.log(`Loaded ${label} signer ${account.address}`);
    return { walletClient, account };
  }

  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /** Signer for a role, or throws OnchainUnavailableError if unconfigured. */
  requireSigner(role: OnchainRole): Signer {
    const signer = role === 'RELAYER' ? this.relayerSigner : this.adminSigner;
    if (!signer) {
      throw new OnchainUnavailableError(role);
    }
    return signer;
  }

  get relayerAddress(): string | null {
    return this.relayerSigner?.account.address ?? null;
  }
  get adminAddress(): string | null {
    return this.adminSigner?.account.address ?? null;
  }
  canWrite(role: OnchainRole): boolean {
    return (role === 'RELAYER' ? this.relayerSigner : this.adminSigner) !== null;
  }
}
