import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../database/entities';

/**
 * Injects the authenticated user (or null) that OptionalAuthGuard / JwtAuthGuard
 * attached to the request. Mirrors Express's `req.user`.
 *
 *   create(@CurrentUser() user: User) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
