import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService, ERatReport } from './reports.service';
import { buildERatWorkbook } from './reports.xlsx';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Pengurus-only e-RAT reporting: aggregate JSON + XLSX export. */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Pengurus)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('e-rat')
  eRat(): Promise<ERatReport> {
    return this.reportsService.eRat();
  }

  @Get('e-rat/export.xlsx')
  async exportERat(@Res() res: Response): Promise<void> {
    const report = await this.reportsService.eRat();
    const buffer = await buildERatWorkbook(report);
    // @Res() disables Nest's auto-serialization: send the buffer ourselves.
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader('Content-Disposition', 'attachment; filename="e-rat.xlsx"');
    res.send(buffer);
  }
}
