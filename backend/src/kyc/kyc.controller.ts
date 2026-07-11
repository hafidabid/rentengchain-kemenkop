import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberDto } from '../common/serializers';
import { S3Service } from '../storage/s3.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly s3: S3Service,
  ) {}

  /** Public onboarding entry point — records a member as Requested. */
  @Post('submit')
  submit(@Body() dto: SubmitKycDto): Promise<MemberDto> {
    return this.kycService.submit(dto);
  }

  /**
   * Public onboarding upload — stores a KTP image and returns its URL, which the
   * caller then passes to `submit` as `ktpUrl`. 503 if storage is unconfigured.
   */
  @Post('upload-ktp')
  @UseInterceptors(FileInterceptor('file'))
  async uploadKtp(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ ktpUrl: string }> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const safeName = (file.originalname || 'ktp').replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `ktp/uploads/${Date.now()}-${safeName}`;
    const ktpUrl = await this.s3.upload(
      key,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );
    return { ktpUrl };
  }

  /** Pengurus approves: sets Approved, mints wallet, anchors on-chain, audits. */
  @Post('approve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  approve(
    @Param('id') id: string,
  ): Promise<MemberDto & { tempPassword?: string }> {
    return this.kycService.approve(id);
  }

  /** Pengurus rotates a member's credential and returns a new one-time password. */
  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  resetPassword(@Param('id') id: string): Promise<{ tempPassword: string }> {
    return this.kycService.resetPassword(id);
  }

  /** Pengurus rejects: sets Rejected, audits, mints no wallet. */
  @Post('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  reject(@Param('id') id: string): Promise<MemberDto> {
    return this.kycService.reject(id);
  }
}
