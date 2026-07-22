import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CertificationApplication,
  Post,
  SiteConfig,
  Topic,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { StorageService } from '../storage/storage.service';

type CertStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
type CertType = 'personal' | 'enterprise';
type CertFile = {
  key: string;
  type: string;
  name: string;
  mimetype: string;
  size?: number;
};

const PERSONAL_LABELS = [
  '行业大佬',
  '技术人员',
  '内容创作者',
  '设计师',
  '开发者',
  '博主',
  '媒体人',
  '其他',
];
const ACTIVE_STATUSES = ['pending', 'approved'];
const REVIEW_STATUSES: CertStatus[] = ['approved', 'rejected', 'revoked'];
const DEFAULT_AUTO_POST_TOPIC = '初来乍到';
const DEFAULT_AUTO_POST_TEMPLATE =
  '{topic}\n\n我刚刚通过了{certName}，欢迎来我的主页认识我。\n\n个人简介：{bio}\n\n个人主页：{profileUrl}';

@Injectable()
export class CertificationsService {
  constructor(
    @InjectRepository(CertificationApplication)
    private readonly applications: Repository<CertificationApplication>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(SiteConfig)
    private readonly siteConfig: Repository<SiteConfig>,
    private readonly helpers: HelpersService,
    private readonly storage: StorageService,
  ) {}

  labels() {
    return PERSONAL_LABELS;
  }

  private clean(value: any, max: number) {
    return String(value ?? '').trim().slice(0, max);
  }

  private parseFiles(json: string | null | undefined): CertFile[] {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed.filter((f) => f?.key);
      if (parsed?.key) return [parsed];
    } catch {
      return [];
    }
    return [];
  }

  private async filePreview(file: CertFile) {
    try {
      const buffer = await this.storage.readPrivate(file.key);
      return `data:${file.mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
    } catch {
      return '';
    }
  }

  private async serializeFile(file: CertFile, includePreview: boolean) {
    const out: any = {
      name: file.name,
      type: file.type,
      mimetype: file.mimetype,
      size: file.size || 0,
    };
    if (includePreview) out.preview = await this.filePreview(file);
    return out;
  }

  private async serialize(
    app: CertificationApplication | null,
    opts: { includePrivate?: boolean; includeUser?: boolean; viewerId?: number | null } = {},
  ) {
    if (!app) return null;
    const proofFiles = this.parseFiles(app.proof_files_json);
    const licenseFiles = this.parseFiles(app.license_file_json);
    return {
      id: app.id,
      type: app.type,
      label: app.label,
      realName: opts.includePrivate ? app.real_name : '',
      contact: opts.includePrivate ? app.contact : '',
      companyName: app.company_name,
      companyInfo: app.company_info || '',
      status: app.status,
      reviewNote: app.review_note || '',
      reviewedAt: app.reviewed_at || null,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      proofFiles: await Promise.all(
        proofFiles.map((f) => this.serializeFile(f, !!opts.includePrivate)),
      ),
      licenseFiles: await Promise.all(
        licenseFiles.map((f) => this.serializeFile(f, !!opts.includePrivate)),
      ),
      user: opts.includeUser
        ? await this.helpers.publicUser(
            await this.users.findOne({ where: { id: app.user_id } }),
            opts.viewerId || null,
          )
        : undefined,
    };
  }

  private async getSiteConfig(key: string, fallback = '') {
    const row = await this.siteConfig.findOne({ where: { key } });
    return row ? String(row.value || '') : fallback;
  }

  private normalizeTopic(raw: any) {
    const value = String(raw ?? '')
      .replace(/#/g, '')
      .trim()
      .slice(0, 30);
    return value || DEFAULT_AUTO_POST_TOPIC;
  }

  private fillTemplate(template: string, vars: Record<string, string>) {
    let out = template;
    for (const [key, value] of Object.entries(vars)) {
      out = out.split(`{${key}}`).join(value);
    }
    return out
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 1000);
  }

  private async resolveTopicId(content: string, fallbackTopic: string) {
    const topicName = this.helpers.parseTopics(content)[0] || fallbackTopic;
    if (!topicName) return null;
    let topic = await this.topics.findOne({ where: { name: topicName } });
    if (!topic) {
      topic = await this.topics.save(
        this.topics.create({ name: topicName, created_at: this.helpers.nowSql() }),
      );
    }
    await this.topics
      .createQueryBuilder()
      .update(Topic)
      .set({
        post_count: () => 'post_count + 1',
        hot: () => 'hot + 1',
      })
      .where('id = :id', { id: topic.id })
      .execute();
    return topic.id;
  }

  private async publishApprovedPost(app: CertificationApplication, body: any) {
    const explicitEnabled = body.autoPostEnabled;
    const enabled =
      explicitEnabled === undefined
        ? (await this.getSiteConfig('cert_auto_post_enabled', '1')) !== '0'
        : explicitEnabled === true || explicitEnabled === 1 || explicitEnabled === '1';
    if (!enabled) return null;

    const user = await this.users.findOne({ where: { id: app.user_id } });
    if (!user) return null;
    const topic = this.normalizeTopic(
      body.autoPostTopic ?? (await this.getSiteConfig('cert_auto_post_topic', DEFAULT_AUTO_POST_TOPIC)),
    );
    const template = this.clean(
      body.autoPostTemplate ??
        (await this.getSiteConfig('cert_auto_post_template', DEFAULT_AUTO_POST_TEMPLATE)),
      1200,
    ) || DEFAULT_AUTO_POST_TEMPLATE;
    const certName = app.type === 'enterprise' ? '企业认证' : `${app.label || '个人'}认证`;
    const certLabel =
      app.type === 'enterprise'
        ? (app.company_name || '企业认证').slice(0, 32)
        : app.label || '个人认证';
    const bio = this.clean(user.bio, 180) || '暂未填写个人简介';
    const profileUrl = `https://saotie.com/u/${encodeURIComponent(user.username)}`;
    const content = this.fillTemplate(template, {
      topic: topic ? `#${topic}#` : '',
      bio,
      profileUrl,
      username: user.username,
      nickname: user.nickname || user.username,
      certName,
      certType: app.type === 'enterprise' ? '企业认证' : '个人认证',
      certLabel,
    });
    if (!content) return null;
    if (checkSensitive(content)) {
      throw new BadRequestException('认证通过动态包含敏感内容，请修改模板后重试');
    }
    const topicId = await this.resolveTopicId(content, topic);
    const post = await this.posts.save(
      this.posts.create({
        user_id: user.id,
        content,
        media: '[]',
        media_type: 'text',
        visibility: 'public',
        password: null,
        price: 0,
        location: '',
        device: '认证系统',
        topic_id: topicId,
        circle_id: null,
        created_at: this.helpers.nowSql(),
      }),
    );
    return post.id;
  }

  private async latestForUser(userId: number) {
    return this.applications.findOne({
      where: { user_id: userId },
      order: { id: 'DESC' },
    });
  }

  async mine(user: User) {
    const freshUser = (await this.users.findOne({ where: { id: user.id } })) || user;
    const application = await this.latestForUser(user.id);
    return {
      labels: this.labels(),
      user: await this.helpers.publicUser(freshUser, user.id),
      application: await this.serialize(application, {
        includePrivate: true,
        viewerId: user.id,
      }),
    };
  }

  async submit(user: User, body: any, files: Express.Multer.File[] = []) {
    const latest = await this.latestForUser(user.id);
    if (latest && ACTIVE_STATUSES.includes(latest.status)) {
      throw new ConflictException(
        latest.status === 'pending'
          ? '已有认证申请正在审核中'
          : '账号已通过认证，如需变更请联系管理员',
      );
    }

    const type = this.clean(body.type, 16) as CertType;
    if (!['personal', 'enterprise'].includes(type)) {
      throw new BadRequestException('认证类型无效');
    }

    const contact = this.clean(body.contact, 64);
    if (contact.length < 5) throw new BadRequestException('请填写有效联系方式');

    const now = this.helpers.nowSql();
    let app: CertificationApplication;
    if (type === 'personal') {
      const label = this.clean(body.label, 32);
      const realName = this.clean(body.realName, 64);
      if (!PERSONAL_LABELS.includes(label)) throw new BadRequestException('请选择认证标签');
      if (realName.length < 2) throw new BadRequestException('请填写真实姓名');
      if (files.length < 1 || files.length > 3) {
        throw new BadRequestException('个人认证需上传 1-3 张证明图片');
      }
      if (checkSensitive(`${label} ${realName}`)) {
        throw new BadRequestException('认证信息包含敏感内容，请修改后重试');
      }
      const uploaded = await this.uploadFiles(files);
      app = this.applications.create({
        user_id: user.id,
        type,
        label,
        real_name: realName,
        contact,
        proof_files_json: JSON.stringify(uploaded),
        status: 'pending',
        created_at: now,
        updated_at: now,
      });
    } else {
      const companyName = this.clean(body.companyName, 128);
      const companyInfo = this.clean(body.companyInfo || body.creditCode, 500);
      if (companyName.length < 2) throw new BadRequestException('请填写企业名称');
      if (files.length < 1) throw new BadRequestException('请上传营业执照图片');
      if (files.length > 1) throw new BadRequestException('企业认证仅需上传 1 张营业执照');
      if (checkSensitive(`${companyName} ${companyInfo}`)) {
        throw new BadRequestException('认证信息包含敏感内容，请修改后重试');
      }
      const uploaded = await this.uploadFiles(files);
      app = this.applications.create({
        user_id: user.id,
        type,
        label: '企业认证',
        contact,
        company_name: companyName,
        company_info: companyInfo,
        license_file_json: JSON.stringify(uploaded[0]),
        status: 'pending',
        created_at: now,
        updated_at: now,
      });
    }

    const saved = await this.applications.save(app);
    return {
      ok: true,
      application: await this.serialize(saved, {
        includePrivate: true,
        viewerId: user.id,
      }),
    };
  }

  private async uploadFiles(files: Express.Multer.File[]) {
    const uploaded: CertFile[] = [];
    for (const f of files) {
      uploaded.push(
        await this.storage.uploadPrivate({
          buffer: f.buffer,
          originalname: f.originalname,
          mimetype: f.mimetype,
        }),
      );
    }
    return uploaded;
  }

  async listAdmin(status = '', type = '', offset = 0) {
    const take = 50;
    const qb = this.applications
      .createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .offset(Math.max(0, offset))
      .limit(take + 1);
    if (['pending', 'approved', 'rejected', 'revoked'].includes(status)) {
      qb.andWhere('c.status = :status', { status });
    }
    if (['personal', 'enterprise'].includes(type)) {
      qb.andWhere('c.type = :type', { type });
    }
    const rows = await qb.getMany();
    const list = rows.slice(0, take);
    return {
      applications: await Promise.all(
        list.map((app) => this.serialize(app, { includeUser: true })),
      ),
      hasMore: rows.length > take,
    };
  }

  async detailAdmin(id: number) {
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('认证申请不存在');
    return {
      application: await this.serialize(app, {
        includePrivate: true,
        includeUser: true,
      }),
    };
  }

  async review(id: number, admin: User, body: any) {
    const status = this.clean(body.status, 16) as CertStatus;
    if (!REVIEW_STATUSES.includes(status)) {
      throw new BadRequestException('审核状态无效');
    }
    const note = this.clean(body.note, 255);
    const app = await this.applications.findOne({ where: { id } });
    if (!app) throw new NotFoundException('认证申请不存在');
    const wasApproved = app.status === 'approved';

    const now = this.helpers.nowSql();
    await this.applications.update(
      { id: app.id },
      {
        status,
        review_note: note,
        reviewed_by: admin.id,
        reviewed_at: now,
        updated_at: now,
      },
    );

    if (status === 'approved') {
      await this.users.update(
        { id: app.user_id },
        {
          cert_type: app.type,
          cert_label:
            app.type === 'enterprise'
              ? (app.company_name || '企业认证').slice(0, 32)
              : app.label,
          cert_approved_at: now,
        },
      );
    } else if (status === 'revoked') {
      await this.users.update(
        { id: app.user_id },
        { cert_type: '', cert_label: '', cert_approved_at: null },
      );
    }
    let announcementPostId: number | null = null;
    let announcementPostError = '';
    if (status === 'approved' && !wasApproved) {
      try {
        announcementPostId = await this.publishApprovedPost(app, body || {});
      } catch (e: any) {
        announcementPostError = e?.message || '认证通过动态发布失败';
      }
    }

    const action =
      status === 'approved'
        ? 'certification.approve'
        : status === 'rejected'
          ? 'certification.reject'
          : 'certification.revoke';
    await this.helpers.logAdmin(admin.id, action, {
      targetType: 'certification_application',
      targetId: app.id,
      detail: `${app.type === 'enterprise' ? '企业' : '个人'}认证 #${app.id} ${status}`,
    });

    await this.helpers.notify({
      userId: app.user_id,
      actorId: admin.id,
      type: 'certification',
      targetType: 'certification',
      targetId: app.id,
      preview:
        status === 'approved'
          ? '认证申请已通过'
          : status === 'rejected'
            ? `认证申请未通过${note ? `：${note}` : ''}`
            : '认证状态已撤销',
    });

    const fresh = await this.applications.findOne({ where: { id: app.id } });
    return {
      ok: true,
      announcementPostId,
      announcementPostError,
      application: await this.serialize(fresh, { includePrivate: true, includeUser: true }),
    };
  }
}
