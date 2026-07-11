import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberDto } from '../common/serializers';
import { MemberDetailDto, MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  findAll(): Promise<MemberDto[]> {
    return this.membersService.findAll();
  }

  // Declared before ':id' so 'me' is not captured as an id param.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMe(@CurrentUser() user: AuthUser): Promise<MemberDto> {
    return this.membersService.findOne(user.userId);
  }

  // Declared before ':id' so 'detail' is resolved against the right handler.
  @Get(':id/detail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Pengurus)
  detail(@Param('id') id: string): Promise<MemberDetailDto> {
    return this.membersService.detail(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MemberDto> {
    return this.membersService.findOneForUser(id, user);
  }
}
