import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { ApproveDto } from './dto/approve.dto';
import { RejectDto } from './dto/reject.dto';
import { SanggahDto } from './dto/sanggah.dto';
import { LoanDecisionDto, LoanDto } from './loans.serializer';
import { LoansService } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  apply(
    @Body() dto: ApplyLoanDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LoanDto> {
    return this.loansService.apply(dto, user);
  }

  @Post('sanggah/:id')
  @UseGuards(JwtAuthGuard)
  sanggah(
    @Param('id') id: string,
    @Body() dto: SanggahDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LoanDto> {
    return this.loansService.sanggah(id, dto, user);
  }

  @Post('approve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LoanDto> {
    return this.loansService.approve(id, dto, user);
  }

  @Post('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LoanDto> {
    return this.loansService.reject(id, dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  findAll(): Promise<LoanDto[]> {
    return this.loansService.findAll();
  }

  @Get(':id/decisions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  findDecisions(@Param('id') id: string): Promise<LoanDecisionDto[]> {
    return this.loansService.findDecisions(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string): Promise<LoanDto> {
    return this.loansService.findOne(id);
  }
}
