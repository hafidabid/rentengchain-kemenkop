import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeFunctionData, type Hex } from 'viem';
import { ESCROW_ABI } from './abis/escrow.abi';
import { OnchainRole, RelayerService } from './relayer.service';

const DEFAULT_ESCROW = '0x199812B240bf8d90dBAfB5C7E2ab79e3fAf728dE';

/** Writable escrow methods only (excludes view functions like nextLoanId). */
export type EscrowFn = Extract<
  (typeof ESCROW_ABI)[number],
  { stateMutability: 'nonpayable' }
>['name'];

/** Which signing key each method needs. RELAYER records ledger events; KOPERASI
 * (admin key) registers members/groups and approves/resolves. fileAppeal has no
 * on-chain role, so the relayer signs it. */
const ROLE_MAP: Record<EscrowFn, OnchainRole> = {
  registerMember: 'KOPERASI',
  registerGroup: 'KOPERASI',
  joinGroup: 'KOPERASI',
  approveLoan: 'KOPERASI',
  deferLoan: 'KOPERASI',
  resolveAppeal: 'KOPERASI',
  recordSavings: 'RELAYER',
  fundSocialFund: 'RELAYER',
  createLoan: 'RELAYER',
  recordScreening: 'RELAYER',
  disburseLoan: 'RELAYER',
  recordRepayment: 'RELAYER',
  applySocialFund: 'RELAYER',
  activateRenteng: 'RELAYER',
  repayTalangan: 'RELAYER',
  fileAppeal: 'RELAYER',
};

export interface EncodedCall {
  address: Hex;
  functionName: EscrowFn;
  args: readonly unknown[];
  data: Hex;
}

export interface SubmitResult {
  txHash: Hex;
  status: 'success' | 'reverted' | 'pending';
}

export interface TrySubmitResult {
  ok: boolean;
  txHash?: Hex;
  status?: 'success' | 'reverted' | 'pending';
  /** Reason when ok is false (missing signer, revert, network). */
  error?: string;
}

/**
 * Typed client for the deployed TanggungRentengEscrow. `buildCall` produces
 * calldata offline (verifiable without any key — used to assert no raw PII is
 * ever submitted); `submit` routes to the correct signer by the method's role.
 */
@Injectable()
export class ContractClientService {
  private readonly logger = new Logger(ContractClientService.name);
  private readonly escrowAddress: Hex;
  private readonly receiptTimeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly relayer: RelayerService,
  ) {
    this.escrowAddress = config.get<string>('ADDR_ESCROW', DEFAULT_ESCROW) as Hex;
    this.receiptTimeoutMs = Number(
      config.get<string>('RECEIPT_TIMEOUT_MS', '15000'),
    );
  }

  roleFor(functionName: EscrowFn): OnchainRole {
    return ROLE_MAP[functionName];
  }

  /** True if the signer for this method's role is configured. */
  canSubmit(functionName: EscrowFn): boolean {
    return this.relayer.canWrite(ROLE_MAP[functionName]);
  }

  /** Read the next loanId the escrow will assign (== the id a createLoan sent
   * now will get). Used to persist onchainLoanId after createLoan. */
  async readNextLoanId(): Promise<bigint> {
    return this.relayer.getPublicClient().readContract({
      address: this.escrowAddress,
      abi: ESCROW_ABI,
      functionName: 'nextLoanId',
    }) as Promise<bigint>;
  }

  /** Encode a call to the escrow contract. Pure, offline, no signing. */
  buildCall(functionName: EscrowFn, args: readonly unknown[]): EncodedCall {
    const data = encodeFunctionData({
      abi: ESCROW_ABI,
      functionName,
      args: args as never,
    });
    return { address: this.escrowAddress, functionName, args, data };
  }

  /**
   * Sign + send an escrow call from the role-appropriate signer. Persists
   * nothing; the caller records the returned txHash. Throws
   * OnchainUnavailableError if the required key is missing (flows catch and
   * degrade). Returns the hash even if the receipt is slow.
   */
  async submit(
    functionName: EscrowFn,
    args: readonly unknown[],
  ): Promise<SubmitResult> {
    const role = ROLE_MAP[functionName];
    const { walletClient, account } = this.relayer.requireSigner(role);
    const publicClient = this.relayer.getPublicClient();

    const txHash = await walletClient.writeContract({
      address: this.escrowAddress,
      abi: ESCROW_ABI,
      functionName,
      args: args as never,
      account,
      chain: walletClient.chain,
    });

    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: this.receiptTimeoutMs,
      });
      return { txHash, status: receipt.status };
    } catch {
      this.logger.warn(
        `Receipt not confirmed within timeout for ${functionName}; returning pending tx ${txHash}`,
      );
      return { txHash, status: 'pending' };
    }
  }

  /**
   * Graceful variant: never throws. Returns { ok:false, error } when the signer
   * is missing or the call reverts, so flows persist off-chain state and audit
   * regardless. `onRevert` (e.g. AlreadyExists) is treated as a soft failure.
   */
  async trySubmit(
    functionName: EscrowFn,
    args: readonly unknown[],
  ): Promise<TrySubmitResult> {
    try {
      const res = await this.submit(functionName, args);
      return { ok: res.status !== 'reverted', txHash: res.txHash, status: res.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`On-chain ${functionName} skipped: ${message}`);
      return { ok: false, error: message };
    }
  }
}
