import { Module } from '@nestjs/common';
import { Web3Module } from '../web3/web3.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [Web3Module],
  controllers: [AdminController],
})
export class AdminModule {}
