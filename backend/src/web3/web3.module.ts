import { Module } from '@nestjs/common';
import { ContractClientService } from './contract-client.service';
import { CryptoService } from './crypto.service';
import { HashingService } from './hashing.service';
import { RelayerService } from './relayer.service';
import { WalletService } from './wallet.service';

/**
 * Shared web3 layer for the flow changes. Exports the custodial-wallet and
 * on-chain-ledger primitives; the four demo flows inject these rather than
 * touching viem directly.
 */
@Module({
  providers: [
    RelayerService,
    CryptoService,
    HashingService,
    WalletService,
    ContractClientService,
  ],
  exports: [
    RelayerService,
    HashingService,
    WalletService,
    ContractClientService,
  ],
})
export class Web3Module {}
