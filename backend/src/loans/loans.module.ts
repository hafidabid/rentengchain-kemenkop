import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { Web3Module } from '../web3/web3.module';
import { GeminiService } from './gemini.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

/**
 * Flow ② — lending, AI risk screening, and appeals. Consumes the shared web3
 * layer (contract client, on-chain sync, hashing) and the append-only audit log.
 */
@Module({
  imports: [Web3Module, AuditModule],
  controllers: [LoansController],
  providers: [LoansService, GeminiService],
  exports: [LoansService, GeminiService],
})
export class LoansModule {}
