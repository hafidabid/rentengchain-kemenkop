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

/**
 * Owns the viem clients and the single master/relayer account. The relayer pays
 * gas and signs every transaction; members never hold keys or gas. The public
 * client works without any secret (read-only), so connectivity can be verified
 * before a funded key is configured.
 *
 * Clients are stored as viem's broad PublicClient/WalletClient interfaces (with a
 * cast) to avoid the deep-generic inference that otherwise blows up tsc.
 */
@Injectable()
export class RelayerService {
  private readonly logger = new Logger(RelayerService.name);
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient | null;
  private readonly account: Account | null;
  readonly rpcUrl: string;

  constructor(config: ConfigService) {
    this.rpcUrl = config.get<string>('BASE_RPC_URL', 'https://sepolia.base.org');
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(this.rpcUrl),
    }) as PublicClient;

    const pk = config.get<string>('RELAYER_PRIVATE_KEY');
    if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
      this.account = privateKeyToAccount(pk as `0x${string}`);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: baseSepolia,
        transport: http(this.rpcUrl),
      }) as WalletClient;
    } else {
      this.account = null;
      this.walletClient = null;
      this.logger.warn(
        'RELAYER_PRIVATE_KEY not configured — on-chain writes are disabled (read-only mode).',
      );
    }
  }

  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /** The relayer wallet client, or throws a clear error if no key is configured. */
  requireWalletClient(): { walletClient: WalletClient; account: Account } {
    if (!this.walletClient || !this.account) {
      throw new Error(
        'Relayer wallet not configured: set RELAYER_PRIVATE_KEY (RELAYER_ROLE holder) and fund it on Base Sepolia.',
      );
    }
    return { walletClient: this.walletClient, account: this.account };
  }

  get address(): string | null {
    return this.account?.address ?? null;
  }

  get canWrite(): boolean {
    return this.walletClient !== null;
  }
}
