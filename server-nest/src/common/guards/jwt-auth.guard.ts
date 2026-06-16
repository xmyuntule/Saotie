import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';

/**
 * Mirrors Express `requireAuth`: 401 ('请先登录') when no valid token / user.
 * On success attaches req.user. Banned users are still attached (the original
 * register/login flow rejects banned at login, route handlers may re-check).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('请先登录');
    let payload: any;
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('请先登录');
    }
    const user = await this.users.findOne({ where: { id: payload.id } });
    if (!user) throw new UnauthorizedException('请先登录');
    req.user = user;
    return true;
  }
}

/**
 * Mirrors Express `requireAdmin`: must be authenticated AND role === 'admin'.
 */
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest();
    if (!req.user || req.user.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return true;
  }
}
