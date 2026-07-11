import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AssistantService,
  ChatResult,
  ChatTurn,
} from './assistant.service';
import { Snapshot } from './metadata-snapshot.service';

/** Request body for the chat endpoint: the conversation so far. */
interface ChatRequest {
  history?: ChatTurn[];
}

/** Pengurus-only cooperative assistant: grounded chat + snapshot inspection. */
@Controller('assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Pengurus)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  chat(@Body() body: ChatRequest): Promise<ChatResult> {
    return this.assistant.chat(body?.history ?? []);
  }

  @Get('snapshot')
  snapshot(): Promise<Snapshot> {
    return this.assistant.getSnapshot();
  }
}
