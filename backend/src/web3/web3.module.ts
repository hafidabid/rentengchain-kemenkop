import { Module } from '@nestjs/common';
import { ContractClientService } from './contract-client.service';
import { CryptoService } from './crypto.service';
import { HashingService } from './hashing.service';
import { OnchainSyncService } from './onchain-sync.service';
import { RelayerService } from './relayer.service';
import { WalletService } from './wallet.service';

/**
 * Shared web3 layer for the flow changes. Exports the custodial-wallet,
 * on-chain-ledger, and registration primitives; the four demo flows inject
 * these rather than touching viem directly.
 */
@Module({
  providers: [
    RelayerService,
    CryptoService,
    HashingService,
    WalletService,
    ContractClientService,
    OnchainSyncService,
  ],
  exports: [
    RelayerService,
    HashingService,
    WalletService,
    ContractClientService,
    OnchainSyncService,
  ],
})
export class Web3Module {}
