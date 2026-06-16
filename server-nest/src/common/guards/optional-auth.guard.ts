import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';

/**
 * Mirrors Express `optionalAuth`: attaches req.user when a valid Bearer token
 * is present, but never blocks the request. Always returns true.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = this.jwt.verify(token, {
          secret: this.config.get('jwt.secret'),
        });
        req.user =
          (await this.users.findOne({ where: { id: payload.id } })) || null;
      } catch {
        /* ignore invalid token, stays anonymous */
      }
    }
    return true;
  }
}
