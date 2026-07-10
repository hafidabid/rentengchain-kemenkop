import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberDto } from '../common/serializers';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /** Public onboarding entry point — records a member as Requested. */
  @Post('submit')
  submit(@Body() dto: SubmitKycDto): Promise<MemberDto> {
    return this.kycService.submit(dto);
  }

  /** Pengurus approves: sets Approved, mints wallet, anchors on-chain, audits. */
  @Post('approve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  approve(@Param('id') id: string): Promise<MemberDto> {
    return this.kycService.approve(id);
  }

  /** Pengurus rejects: sets Rejected, audits, mints no wallet. */
  @Post('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  reject(@Param('id') id: string): Promise<MemberDto> {
    return this.kycService.reject(id);
  }
}
