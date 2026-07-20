import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { CheckinLog, User } from '../../database/entities';
import { defaultAvatar } from '../../common/default-avatar';
import { EntitlementService } from '../../common/entitlement.service';
import { HelpersService } from '../../common/helpers.service';
import { RateLimitService } from '../../common/rate-limit.service';
import { SiteService } from '../site/site.service';
import { checkSensitive } from '../../common/sensitive';
import {
  ChangePasswordDto,
  ChangeUsernameDto,
  LoginDto,
  RegisterDto,
} from './dto/auth.dto';

const USERNAME_RE = /^[A-Za-z0-9_一-龥]{2,20}$/;
const CAPTCHA_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CAPTCHA_TTL_MS = 10 * 60 * 1000;

interface LoginGuard {
  enabled: boolean;
  captchaEnabled: boolean;
  windowMin: number;
  lockMin: number;
  ipLimit: number;
  userFailLimit: number;
  captchaAfter: number;
  userCaptchaAfter: number;
  ipFailKey: string;
  userFailKey: string;
  ipLockKey: string;
  userLockKey: string;
  ipCount: number;
  userCount: number;
  requiresCaptcha: boolean;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CheckinLog) private readonly checkinLog: Repository<CheckinLog>,
    private readonly helpers: HelpersService,
    private readonly entitlements: EntitlementService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly site: SiteService,
    private readonly rateLimit: RateLimitService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * 首启自动建管理员（opt-in，便于「全新部署 / 别的 agent」免手动 SQL 提权）。
   * 仅当 env 同时给了 SEED_ADMIN_USER + SEED_ADMIN_PASSWORD，且库里还没有任何 admin 时才建。
   * 不给 env = 完全不动（默认行为不变）；已有 admin = 静默跳过 → 对线上（已有管理员）是 no-op，安全幂等。
   */
  async onApplicationBootstrap(): Promise<void> {
    const username = (process.env.SEED_ADMIN_USER || '').trim();
    const password = process.env.SEED_ADMIN_PASSWORD || '';
    if (!username || !password) return; // 未开启
    try {
      const admins = await this.users.count({ where: { role: 'admin' } });
      if (admins > 0) return; // 已有管理员，绝不覆盖/新增
      if (!USERNAME_RE.test(username)) {
        this.logger.warn(
          `[seed-admin] SEED_ADMIN_USER「${username}」格式非法（2-20 位字母/数字/下划线/中文），跳过`,
        );
        return;
      }
      if (password.length < 6) {
        this.logger.warn('[seed-admin] SEED_ADMIN_PASSWORD 至少 6 位，跳过');
        return;
      }
      if (await this.users.findOne({ where: { username } })) {
        this.logger.warn(
          `[seed-admin] 用户名「${username}」已存在但非管理员，未自动提权（请手动处理），跳过`,
        );
        return;
      }
      const now = this.helpers.nowSql();
      const admin = this.users.create({
        username,
        nickname: username,
        password_hash: bcrypt.hashSync(password, 10),
        role: 'admin',
        bio: '',
        avatar: defaultAvatar(username),
        experience: 20,
        points: 100,
        balance: 0,
        invited_by: null,
        created_at: now,
        updated_at: now,
      });
      await this.users.save(admin);
      this.logger.log(
        `[seed-admin] 已创建初始管理员「${username}」（首启 bootstrap）。请尽快登录后修改密码。`,
      );
    } catch (e: any) {
      // 不阻断启动：建管理员失败只告警
      this.logger.warn(`[seed-admin] 初始化失败（已忽略）：${e?.message || e}`);
    }
  }

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

  private async registerVerifyMode(): Promise<'none' | 'captcha' | 'email'> {
    const raw = String(await this.site.getConfig('register_verify_mode', 'none') || 'none').toLowerCase();
    if (raw === 'captcha' || raw === 'email') return raw;
    return 'none';
  }

  private async cfgBool(key: string, defaultValue = false): Promise<boolean> {
    const raw = await this.site.getConfig(key);
    if (raw == null || raw === '') return defaultValue;
    return raw === '1' || raw === 'true';
  }

  private async cfgInt(key: string, fallback: number, min: number, max: number): Promise<number> {
    const raw = await this.site.getConfig(key);
    if (raw == null || raw === '') return fallback;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  private captchaHash(answer: string) {
    return createHash('sha256')
      .update(String(answer || '').trim().toUpperCase())
      .digest('hex');
  }

  private captchaKey(scope: 'register' | 'login', token: string) {
    return `captcha:${scope}:${token}`;
  }

  private randomCaptcha() {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      out += CAPTCHA_CHARS[randomInt(0, CAPTCHA_CHARS.length)];
    }
    return out;
  }

  private captchaSvg(code: string) {
    const width = 176;
    const height = 56;
    const colors = ['#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#e11d48'];
    const bgLines = Array.from({ length: 12 }).map((_, i) => {
      const x1 = randomInt(-10, width);
      const y1 = randomInt(0, height);
      const x2 = randomInt(0, width + 10);
      const y2 = randomInt(0, height);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i % colors.length]}" stroke-opacity=".2" stroke-width="${randomInt(1, 3)}"/>`;
    }).join('');
    const curves = Array.from({ length: 4 }).map((_, i) => {
      const y = randomInt(12, height - 10);
      const c1x = randomInt(20, 70);
      const c1y = randomInt(0, height);
      const c2x = randomInt(90, 150);
      const c2y = randomInt(0, height);
      return `<path d="M -8 ${y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${width + 8} ${randomInt(8, height - 6)}" fill="none" stroke="${colors[(i + 2) % colors.length]}" stroke-opacity=".34" stroke-width="${randomInt(2, 4)}"/>`;
    }).join('');
    const dots = Array.from({ length: 56 }).map(() => {
      const x = randomInt(2, width - 2);
      const y = randomInt(2, height - 2);
      return `<circle cx="${x}" cy="${y}" r="${randomInt(1, 3)}" fill="#64748b" fill-opacity=".3"/>`;
    }).join('');
    const text = code.split('').map((ch, i) => {
      const x = 20 + i * 30 + randomInt(-3, 4);
      const y = 38 + randomInt(-6, 7);
      const rotate = randomInt(-24, 25);
      const scale = 0.9 + randomInt(0, 18) / 100;
      const color = colors[randomInt(0, colors.length)];
      return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y}) scale(${scale} 1)" fill="${color}" stroke="#0f172a" stroke-opacity=".14" stroke-width=".7" font-size="27" font-family="Arial, Helvetica, sans-serif" font-weight="900">${ch}</text>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="w"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${randomInt(1, 999)}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs><rect width="${width}" height="${height}" rx="12" fill="#f8fafc"/><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="11" fill="none" stroke="#cbd5e1"/>${bgLines}${dots}<g filter="url(#w)">${text}</g>${curves}</svg>`;
  }

  private async createCaptchaPayload(scope: 'register' | 'login') {
    const token = randomBytes(18).toString('hex');
    const answer = this.randomCaptcha();
    await this.cache.set(this.captchaKey(scope, token), this.captchaHash(answer), CAPTCHA_TTL_MS);
    const svg = this.captchaSvg(answer);
    return {
      required: true,
      token,
      image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      expiresIn: Math.round(CAPTCHA_TTL_MS / 1000),
    };
  }

  async createRegisterCaptcha(_ip?: string) {
    const mode = await this.registerVerifyMode();
    if (mode !== 'captcha') return { required: false };
    return this.createCaptchaPayload('register');
  }

  async createLoginCaptcha(_ip?: string) {
    if (!(await this.cfgBool('login_protect_enabled', true))) return { required: false };
    if (!(await this.cfgBool('login_captcha_enabled', true))) return { required: false };
    return this.createCaptchaPayload('login');
  }

  private async verifyCaptcha(scope: 'register' | 'login', token?: string, answer?: string) {
    const rawToken = String(token || '').trim();
    const rawAnswer = String(answer || '').trim();
    if (!rawToken || !rawAnswer) throw new BadRequestException('请先完成图形验证码');
    const key = this.captchaKey(scope, rawToken);
    const expected = String(await this.cache.get(key) || '');
    await (this.cache as any).del?.(key);
    if (!expected) throw new BadRequestException('验证码已过期，请刷新后重试');
    const actual = this.captchaHash(rawAnswer);
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('验证码不正确，请重新输入');
    }
  }

  private async enforceRegisterVerification(dto: RegisterDto) {
    const mode = await this.registerVerifyMode();
    if (mode === 'none') return;
    if (mode === 'email') {
      throw new BadRequestException('邮箱验证尚未配置，请先在后台切换为图形验证码或关闭注册验证');
    }
    await this.verifyCaptcha('register', dto?.captchaToken, dto?.captchaAnswer);
  }

  async register(dto: RegisterDto, ip?: string) {
    await this.enforceRegisterVerification(dto);
    await this.rateLimit.enforceRegistration(ip); // 防批量注册：按 IP 限每日数/最小间隔（开关关或无 IP 则放行）
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
    const avatar = defaultAvatar(username);
    const now = this.helpers.nowSql();
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
      created_at: now,
      updated_at: now,
      last_login_at: now,
    });
    const user = await this.users.save(inserted);
    await this.helpers.logAsset(
      user.id,
      'points',
      user.points,
      inviter ? '受邀注册见面礼' : '注册见面礼',
      'auth_register',
      user.id,
      user.points,
    );

    // welcome notification (actorId null => not skipped because userId !== null)
    await this.helpers.notify({
      userId: user.id,
      actorId: null,
      type: 'system',
      preview: inviter
        ? `欢迎加入 SaotieSNS！受邀注册 +30 积分见面礼 🎁`
        : '欢迎加入 SaotieSNS！完善资料、发布第一条动态吧～',
    });

    // 邀请奖励：邀请人 +50 积分 +10 经验，并收到通知
    if (inviter) {
      await this.helpers.award(inviter.id, {
        exp: 10,
        points: 50,
        reason: '邀请好友注册奖励',
        refType: 'invite',
        refId: user.id,
      });
      await this.helpers.notify({
        userId: inviter.id,
        actorId: user.id,
        type: 'system',
        preview: `${user.nickname} 通过你的邀请加入了 SaotieSNS，奖励 +50 积分 🎉`,
      });
    }

    return {
      token: this.sign(user),
      user: await this.helpers.publicUser(user, user.id),
    };
  }

  private loginNameKey(username?: string) {
    return (String(username || '').trim().toLowerCase() || 'empty').slice(0, 80);
  }

  private loginIpKey(ip?: string) {
    return String(ip || '').trim().replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 80);
  }

  private failKey(kind: 'ip' | 'user', value: string) {
    return `login:fail:${kind}:${value}`;
  }

  private lockKey(kind: 'ip' | 'user', value: string) {
    return `login:lock:${kind}:${value}`;
  }

  private async cacheNum(key: string) {
    return Number(await this.cache.get(key)) || 0;
  }

  private async readLoginGuard(username: string, ip: string | undefined, user: User | null): Promise<LoginGuard> {
    const enabled = await this.cfgBool('login_protect_enabled', true);
    const captchaEnabled = await this.cfgBool('login_captcha_enabled', true);
    const adminStrict = await this.cfgBool('login_admin_strict_enabled', true);
    const windowMin = await this.cfgInt('login_window_min', 10, 1, 1440);
    const lockMin = await this.cfgInt('login_lock_min', 15, 1, 1440);
    const ipLimit = await this.cfgInt('login_ip_fail_limit', 10, 1, 1000);
    const userLimit = await this.cfgInt('login_user_fail_limit', 5, 1, 1000);
    const adminLimit = await this.cfgInt('login_admin_fail_limit', 3, 1, 1000);
    const captchaAfter = await this.cfgInt('login_captcha_after_fail', 3, 1, 1000);
    const adminCaptchaAfter = await this.cfgInt('login_admin_captcha_after_fail', 1, 1, 1000);
    const isAdmin = !!user && user.role === 'admin' && adminStrict;
    const userFailLimit = isAdmin ? adminLimit : userLimit;
    const userCaptchaAfter = isAdmin ? adminCaptchaAfter : captchaAfter;
    const userKey = this.loginNameKey(username);
    const ipKey = this.loginIpKey(ip);
    const ipFailKey = ipKey ? this.failKey('ip', ipKey) : '';
    const userFailKey = this.failKey('user', userKey);
    const ipCount = ipFailKey ? await this.cacheNum(ipFailKey) : 0;
    const userCount = await this.cacheNum(userFailKey);
    return {
      enabled,
      captchaEnabled,
      windowMin,
      lockMin,
      ipLimit,
      userFailLimit,
      captchaAfter,
      userCaptchaAfter,
      ipFailKey,
      userFailKey,
      ipLockKey: ipKey ? this.lockKey('ip', ipKey) : '',
      userLockKey: this.lockKey('user', userKey),
      ipCount,
      userCount,
      requiresCaptcha: enabled && captchaEnabled && (
        ipCount >= captchaAfter || userCount >= userCaptchaAfter
      ),
    };
  }

  private async enforceLoginGuard(guard: LoginGuard) {
    if (!guard.enabled) return;
    const locked =
      (guard.ipLockKey && (await this.cache.get(guard.ipLockKey))) ||
      (await this.cache.get(guard.userLockKey));
    if (locked) {
      throw new HttpException(
        `登录失败过多，请 ${guard.lockMin} 分钟后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordLoginFailure(guard: LoginGuard) {
    if (!guard.enabled) return { locked: false, requiresCaptcha: false };
    const ttl = guard.windowMin * 60 * 1000;
    const lockTtl = guard.lockMin * 60 * 1000;
    let locked = false;
    let ipCount = guard.ipCount;
    let userCount = guard.userCount;
    if (guard.ipFailKey) {
      ipCount += 1;
      await this.cache.set(guard.ipFailKey, ipCount, ttl);
      if (ipCount >= guard.ipLimit) {
        await this.cache.set(guard.ipLockKey, 1, lockTtl);
        locked = true;
      }
    }
    userCount += 1;
    await this.cache.set(guard.userFailKey, userCount, ttl);
    if (userCount >= guard.userFailLimit) {
      await this.cache.set(guard.userLockKey, 1, lockTtl);
      locked = true;
    }
    return {
      locked,
      requiresCaptcha: guard.captchaEnabled && (
        ipCount >= guard.captchaAfter || userCount >= guard.userCaptchaAfter
      ),
    };
  }

  private async clearLoginFailures(guard: LoginGuard) {
    await (this.cache as any).del?.(guard.userFailKey);
    if (guard.ipFailKey) await (this.cache as any).del?.(guard.ipFailKey);
  }

  async login(dto: LoginDto, ip?: string) {
    const username = String(dto?.username || '').trim();
    const password = String(dto?.password || '');
    const user = username ? await this.users.findOne({ where: { username } }) : null;
    const guard = await this.readLoginGuard(username, ip, user);
    await this.enforceLoginGuard(guard);
    if (guard.requiresCaptcha) {
      await this.verifyCaptcha('login', dto?.captchaToken, dto?.captchaAnswer);
    }
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      const result = await this.recordLoginFailure(guard);
      if (result.locked) {
        throw new HttpException(
          `登录失败过多，请 ${guard.lockMin} 分钟后再试`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException(
        result.requiresCaptcha
          ? '用户名或密码错误，请完成图形验证码后再试'
          : '用户名或密码错误',
      );
    }
    if (user.banned)
      throw new ForbiddenException('账号已被封禁，如有疑问请联系管理员');
    await this.clearLoginFailures(guard);
    const now = this.helpers.nowSql();
    await this.users.update(
      { id: user.id },
      { last_login_at: now, updated_at: now },
    );
    user.last_login_at = now;
    user.updated_at = now;
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
    const vipMult = this.helpers.vipMultiplier(user);
    const points = Math.round((base + bonus) * vipMult);
    const exp = 5;
    const best = Math.max(streak, user.best_checkin_streak || 0);
    await this.users.update(
      { id: user.id },
      {
        checkin_streak: streak,
        last_checkin: t,
        best_checkin_streak: best,
        experience: user.experience + exp,
      },
    );
    await this.helpers.adjustPoints(
      user.id,
      points,
      `每日签到奖励（连签 ${streak} 天）`,
      'checkin',
      null,
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
    const newNickname = (dto?.nickname || '').trim();
    const changeUsername = !!newName && newName !== user.username;
    const changeNickname = !!newNickname && newNickname !== user.nickname;
    if (!changeUsername && !changeNickname)
      throw new BadRequestException('请输入新的用户名或昵称');

    if (newName && !USERNAME_RE.test(newName))
      throw new BadRequestException(
        '用户名需为 2-20 位字母、数字、下划线或中文',
      );
    if (changeUsername && checkSensitive(newName))
      throw new BadRequestException('用户名包含敏感信息');
    if (dto?.nickname != null && !newNickname)
      throw new BadRequestException('昵称不能为空');
    if (newNickname && (newNickname.length < 1 || newNickname.length > 20))
      throw new BadRequestException('昵称需为 1-20 个字符');
    if (changeNickname && checkSensitive(newNickname))
      throw new BadRequestException('昵称包含敏感信息');
    if (changeUsername) {
      const taken = await this.users
        .createQueryBuilder('u')
        .where('u.username = :newName AND u.id != :id', { newName, id: user.id })
        .getOne();
      if (taken) throw new ConflictException('该用户名已被占用');
    }

    const card = await this.entitlements.consumeRenameCard(user.id);
    if (!card)
      throw new ForbiddenException('需要一张「改名卡」，请先到积分商城兑换');

    const patch: Partial<User> = { updated_at: this.helpers.nowSql() };
    if (changeUsername) patch.username = newName;
    if (changeNickname) patch.nickname = newNickname;
    await this.users.update({ id: user.id }, patch);
    const fresh = await this.helpers.getUser(user.id);
    return { ok: true, user: await this.helpers.publicUser(fresh, user.id) };
  }
}
