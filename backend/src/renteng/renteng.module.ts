import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { Web3Module } from '../web3/web3.module';
import { RentengController } from './renteng.controller';
import { RentengService } from './renteng.service';

/**
 * Flow ③ — tanggung renteng bailout. Consumes the shared web3 layer (contract
 * client) and the append-only audit log; reuses the loans serializer for output.
 */
@Module({
  imports: [Web3Module, AuditModule],
  controllers: [RentengController],
  providers: [RentengService],
  exports: [RentengService],
})
export class RentengModule {}
