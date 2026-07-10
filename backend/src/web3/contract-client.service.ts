import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeFunctionData, type Hex } from 'viem';
import { ESCROW_ABI } from './abis/escrow.abi';
import { RelayerService } from './relayer.service';

const DEFAULT_ESCROW = '0x199812B240bf8d90dBAfB5C7E2ab79e3fAf728dE';

export type EscrowFn = (typeof ESCROW_ABI)[number]['name'];

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

/**
 * Typed client for the deployed TanggungRentengEscrow. `buildCall` produces the
 * calldata offline (verifiable without any key — used to assert no raw PII is
 * ever submitted); `submit` signs and sends via the relayer.
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
    this.escrowAddress = config.get<string>(
      'ADDR_ESCROW',
      DEFAULT_ESCROW,
    ) as Hex;
    this.receiptTimeoutMs = Number(
      config.get<string>('RECEIPT_TIMEOUT_MS', '15000'),
    );
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
   * Sign + send an escrow call from the relayer. Persists nothing; the caller
   * records the returned txHash. Returns the hash even if the receipt is slow.
   */
  async submit(
    functionName: EscrowFn,
    args: readonly unknown[],
  ): Promise<SubmitResult> {
    const { walletClient, account } = this.relayer.requireWalletClient();
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
}
