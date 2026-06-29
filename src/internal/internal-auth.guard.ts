import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { env } from '../config/env';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const secret = req.headers['x-internal-secret'];
    if (!env.INTERNAL_API_SECRET || secret !== env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
