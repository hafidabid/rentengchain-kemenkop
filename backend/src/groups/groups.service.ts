import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupDto, toGroupDto } from '../common/serializers';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve anggotaIds for a group from the member_groups bridge (NOT a stored column). */
  private async resolveAnggotaIds(groupId: string): Promise<string[]> {
    const rows = await this.prisma.memberGroup.findMany({
      where: { groupId },
    });
    return rows.map((row) => row.memberId);
  }

  async findAll(): Promise<GroupDto[]> {
    const groups = await this.prisma.group.findMany();
    return Promise.all(
      groups.map(async (group) =>
        toGroupDto(group, await this.resolveAnggotaIds(group.id)),
      ),
    );
  }

  async findOne(id: string): Promise<GroupDto> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Group ${id} not found`);
    }
    return toGroupDto(group, await this.resolveAnggotaIds(id));
  }
}
