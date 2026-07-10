import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RelayerService } from '../web3/relayer.service';
import { OnchainSyncService } from '../web3/onchain-sync.service';

/**
 * Pengurus-only operational endpoints. `bootstrap-onchain` registers the seeded
 * members/group/memberships on-chain so the RELAYER ledger flows go live; it is
 * idempotent and safe to re-run.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Pengurus)
export class AdminController {
  constructor(
    private readonly onchain: OnchainSyncService,
    private readonly relayer: RelayerService,
  ) {}

  @Get('onchain-status')
  status() {
    return {
      relayerAddress: this.relayer.relayerAddress,
      adminAddress: this.relayer.adminAddress,
      canRelayerWrite: this.relayer.canWrite('RELAYER'),
      canKoperasiWrite: this.relayer.canWrite('KOPERASI'),
    };
  }

  @Post('bootstrap-onchain')
  bootstrap() {
    return this.onchain.bootstrapSeeded();
  }
}
