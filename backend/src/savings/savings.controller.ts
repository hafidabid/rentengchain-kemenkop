import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSavingDto } from './dto/create-saving.dto';
import { SavingDto } from './savings.serializer';
import { SavingsService } from './savings.service';

@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSavingDto): Promise<SavingDto> {
    return this.savingsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query('memberId') memberId: string): Promise<SavingDto[]> {
    return this.savingsService.findByMember(memberId);
  }
}
