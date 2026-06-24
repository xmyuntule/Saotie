import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CheckinLog, Order, Product, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { SiteService } from '../site/site.service';
import { checkSensitive } from '../../common/sensitive';
import {
  ChangePasswordDto,
  ChangeUsernameDto,
  LoginDto,
  RegisterDto,
} from './dto/auth.dto';

const USERNAME_RE = /^[A-Za-z0-9_一-龥]{2,20}$/;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(CheckinLog) private readonly checkinLog: Repository<CheckinLog>,
    private readonly helpers: HelpersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly site: SiteService,
  ) {}

  /** Issue a 30d token carrying { id, username } — matches Express sign(). */
  sign(user: User): string {
    return this.jwt.sign(
      { id: user.id, username: user.username },
      {
        secret: this.config.get('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn'),
      },
    );
  }

  async register(dto: RegisterDto) {
    const { username, password, nickname, inviteCode } = dto || {};
    if (!username || !password)
      throw new BadRequestException('用户名和密码必填');
    if (!USERNAME_RE.test(username))
      throw new BadRequestException(
        '用户名需为 2-20 位字母、数字、下划线或中文',
      );
    if (password.length < 6) throw new BadRequestException('密码至少 6 位');
    if (checkSensitive(username) || checkSensitive(nickname))
      throw new BadRequestException('用户名或昵称包含敏感信息');

    const exists = await this.users.findOne({ where: { username } });
    if (exists) throw new ConflictException('该用户名已被注册');

    // 邀请码 = 邀请人的用户名（可选）。校验存在、非自己。
    let inviter: User | null = null;
    const code = (inviteCode || '').trim();
    if (code) {
      inviter = await this.users.findOne({ where: { username: code } });
      // 邀请人无效就静默忽略（不挡注册）；自己邀请自己不可能(用户名尚未存在)
    }

    const hash = bcrypt.hashSync(password, 10);
    const avatar = `https://i.pravatar.cc/240?u=${encodeURIComponent(username)}`;
    const inserted = this.users.create({
      username,
      nickname: nickname?.trim() || username,
      password_hash: hash,
      bio: '',
      avatar,
      experience: 20,
      // 受邀注册：新人额外 +30 积分见面礼（基础 100）
      points: inviter ? 130 : 100,
      balance: 0,
      invited_by: inviter ? inviter.id : null,
      created_at: this.helpers.nowSql(),
      updated_at: this.helpers.nowSql(),
    });
    const user = await this.users.save(inserted);

    // welcome notification (actorId null => not skipped because userId !== null)
    await this.helpers.notify({
      userId: user.id,
      actorId: null,
      type: 'system',
      preview: inviter
        ? `欢迎加入 HahaSNS！受邀注册 +30 积分见面礼 🎁`
        : '欢迎加入 HahaSNS！完善资料、发布第一条动态吧～',
    });

    // 邀请奖励：邀请人 +50 积分 +10 经验，并收到通知
    if (inviter) {
      await this.helpers.award(inviter.id, { exp: 10, points: 50 });
      await this.helpers.notify({
        userId: inviter.id,
        actorId: user.id,
        type: 'system',
        preview: `${user.nickname} 通过你的邀请加入了 HahaSNS，奖励 +50 积分 🎉`,
      });
    }

    return {
      token: this.sign(user),
      user: await this.helpers.publicUser(user, user.id),
    };
  }

  async login(dto: LoginDto) {
    const { username, password } = dto || {};
    const user = await this.users.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password || '', user.password_hash))
      throw new UnauthorizedException('用户名或密码错误');
    if (user.banned)
      throw new ForbiddenException('账号已被封禁，如有疑问请联系管理员');
    return {
      token: this.sign(user),
      user: await this.helpers.publicUser(user, user.id),
    };
  }

  async me(user: User) {
    return { user: await this.helpers.publicUser(user, user.id) };
  }

  async changePassword(user: User, dto: ChangePasswordDto) {
    const { oldPassword, newPassword } = dto || {};
    if (!bcrypt.compareSync(oldPassword || '', user.password_hash))
      throw new ForbiddenException('原密码不正确');
    if (!newPassword || newPassword.length < 6)
      throw new BadRequestException('新密码至少 6 位');
    await this.users.update(
      { id: user.id },
      { password_hash: bcrypt.hashSync(newPassword, 10) },
    );
    return { ok: true };
  }

  async checkin(user: User) {
    const t = this.helpers.today();
    if (user.last_checkin === t)
      throw new BadRequestException('今天已经签到啦');
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    const streak =
      user.last_checkin === yesterday ? (user.checkin_streak || 0) + 1 : 1;
    // 基础分 / 连签加成上限 后台可配(site_config，与 CheckinService.cfg 同源)
    const cfgNum = async (k: string, def: number) => {
      const v = await this.site.getConfig(k);
      return v === null || v === '' ? def : Number(v);
    };
    const base = await cfgNum('checkin_base_points', 5);
    const cap = await cfgNum('checkin_streak_cap', 7);
    const bonus = Math.min(streak, cap);
    // VIP 多等级积分加成（落地 v2.73 权益）：VIP1 +20% / VIP2 +50% / VIP3 翻倍
    const vipLevel = user.vip_level || (user.vip ? 1 : 0);
    const vipMult = vipLevel === 3 ? 2 : vipLevel === 2 ? 1.5 : vipLevel === 1 ? 1.2 : 1;
    const points = Math.round((base + bonus) * vipMult);
    const exp = 5;
    const best = Math.max(streak, user.best_checkin_streak || 0);
    await this.users.update(
      { id: user.id },
      {
        checkin_streak: streak,
        last_checkin: t,
        best_checkin_streak: best,
        points: user.points + points,
        experience: user.experience + exp,
      },
    );
    // 记录当日签到（PK user_id+date，幂等）
    await this.checkinLog
      .createQueryBuilder()
      .insert()
      .into(CheckinLog)
      .values({ user_id: user.id, date: t, points, makeup: 0 })
      .orIgnore()
      .execute();
    const fresh = await this.helpers.getUser(user.id);
    return {
      ok: true,
      streak,
      pointsEarned: points,
      expEarned: exp,
      vipMult,
      user: await this.helpers.publicUser(fresh, user.id),
    };
  }

  async changeUsername(user: User, dto: ChangeUsernameDto) {
    const newName = (dto?.username || '').trim();
    if (!USERNAME_RE.test(newName))
      throw new BadRequestException(
        '用户名需为 2-20 位字母、数字、下划线或中文',
      );
    if (checkSensitive(newName))
      throw new BadRequestException('用户名包含敏感信息');
    if (newName === user.username)
      throw new BadRequestException('新用户名与当前一致');
    const taken = await this.users
      .createQueryBuilder('u')
      .where('u.username = :newName AND u.id != :id', { newName, id: user.id })
      .getOne();
    if (taken) throw new ConflictException('该用户名已被占用');

    // consume one unused 改名卡 (product payload 'rename')
    const card = await this.orders
      .createQueryBuilder('o')
      .innerJoin(Product, 'p', 'p.id = o.product_id')
      .where(
        "o.user_id = :uid AND p.payload = 'rename' AND o.used = 0",
        { uid: user.id },
      )
      .orderBy('o.created_at', 'ASC')
      .getOne();
    if (!card)
      throw new ForbiddenException('需要一张「改名卡」，请先到积分商城兑换');

    await this.orders.update({ id: card.id }, { used: 1 });
    await this.users.update({ id: user.id }, { username: newName });
    const fresh = await this.helpers.getUser(user.id);
    return { ok: true, user: await this.helpers.publicUser(fresh, user.id) };
  }
}
