import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { Web3Module } from '../web3/web3.module';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

/**
 * Flow ④: savings + on-chain audit trail. Imports Web3Module (HashingService,
 * ContractClientService) and AuditModule (AuditLogService); PrismaModule is global.
 */
@Module({
  imports: [Web3Module, AuditModule],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService],
})
export class SavingsModule {}
