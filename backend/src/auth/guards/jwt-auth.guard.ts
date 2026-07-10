import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid JWT bearer token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
