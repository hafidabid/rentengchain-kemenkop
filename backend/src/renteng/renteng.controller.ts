import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LoanDto } from '../loans/loans.serializer';
import { BailoutDto } from './dto/bailout.dto';
import { RepayTalanganDto } from './dto/repay-talangan.dto';
import { BailoutResult, RentengService } from './renteng.service';

@Controller('renteng')
export class RentengController {
  constructor(private readonly rentengService: RentengService) {}

  @Post(':loanId/bailout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  bailout(
    @Param('loanId') loanId: string,
    @Body() dto: BailoutDto,
    @CurrentUser() user: AuthUser,
  ): Promise<BailoutResult> {
    return this.rentengService.bailout(loanId, dto, user);
  }

  @Post(':loanId/repay-talangan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  repayTalangan(
    @Param('loanId') loanId: string,
    @Body() dto: RepayTalanganDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LoanDto> {
    return this.rentengService.repayTalangan(loanId, dto, user);
  }
}
