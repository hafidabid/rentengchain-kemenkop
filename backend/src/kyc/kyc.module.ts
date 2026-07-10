import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { Web3Module } from '../web3/web3.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

/**
 * Flow ①: onboarding + wallet mint. Imports Web3Module (WalletService,
 * OnchainSyncService) and AuditModule (AuditLogService); PrismaModule is global.
 */
@Module({
  imports: [Web3Module, AuditModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
