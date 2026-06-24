import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PaymentOrder, User } from '../../database/entities';
import { SiteService } from '../site/site.service';
import { HelpersService } from '../../common/helpers.service';

const POINTS_PER_YUAN = 100; // 1 元 = 100 积分

/**
 * 易支付（彩虹/标准 epay 协议）端到端：下单 → MD5 签名 → 跳转 → 异步回调验签 → 到账。
 * 凭据(pid/key/网关)存 site_config，仅 admin 可改；本服务读取使用。
 */
@Injectable()
export class PayService {
  constructor(
    @InjectRepository(PaymentOrder)
    private readonly orders: Repository<PaymentOrder>,
    private readonly site: SiteService,
    private readonly helpers: HelpersService,
  ) {}

  private md5(s: string): string {
    return crypto.createHash('md5').update(s, 'utf8').digest('hex');
  }

  // 签名：非空参数(排除 sign/sign_type)按 key 升序拼 a=1&b=2…，末尾直接接商户 KEY，md5 小写
  private epaySign(params: Record<string, any>, key: string): string {
    const keys = Object.keys(params)
      .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
      .sort();
    const str = keys.map((k) => `${k}=${params[k]}`).join('&') + key;
    return this.md5(str);
  }

  private async epayConfig() {
    return {
      enabled: (await this.site.getConfig('pay_epay_enabled')) === '1',
      pid: (await this.site.getConfig('pay_epay_pid')) || '',
      key: (await this.site.getConfig('pay_epay_key')) || '',
      url: (await this.site.getConfig('pay_epay_url')) || '',
    };
  }

  // 创建易支付订单，返回跳转支付的 URL
  async createEpay(user: User, amountRaw: any, channelRaw: string, baseUrl: string) {
    const cfg = await this.epayConfig();
    if (!cfg.enabled || !cfg.pid || !cfg.key || !cfg.url)
      throw new BadRequestException('易支付未配置或未启用');
    const amt = Math.round((Number(amountRaw) || 0) * 100) / 100;
    if (!(amt >= 1 && amt <= 100000))
      throw new BadRequestException('金额需在 1–100000 元之间');
    const money = amt.toFixed(2);
    const type = channelRaw === 'wxpay' ? 'wxpay' : 'alipay';
    const points = Math.round(amt * POINTS_PER_YUAN);
    const outTradeNo =
      'E' + this.helpers.nowSql().replace(/\D/g, '') + Math.floor(1000 + Math.random() * 9000);
    await this.orders.save(
      this.orders.create({
        out_trade_no: outTradeNo,
        user_id: user.id,
        gateway: 'epay',
        channel: type,
        amount: money,
        points,
        status: 'pending',
        created_at: this.helpers.nowSql(),
      }),
    );
    const gw = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/';
    const params: Record<string, string> = {
      pid: cfg.pid,
      type,
      out_trade_no: outTradeNo,
      notify_url: `${baseUrl}/api/pay/epay/notify`,
      return_url: `${baseUrl}/api/pay/epay/return`,
      name: `积分充值 ${points}`,
      money,
      sign_type: 'MD5',
    };
    params.sign = this.epaySign(params, cfg.key);
    const qs = Object.keys(params)
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join('&');
    return { payUrl: `${gw}submit.php?${qs}`, outTradeNo, points, money };
  }

  // 异步回调：验签 → 标记已支付 → 到账积分（幂等）。成功须返回字面量 "success"
  async handleEpayNotify(query: Record<string, string>): Promise<string> {
    const cfg = await this.epayConfig();
    if (!cfg.key) return 'fail';
    if (!query.sign || query.sign !== this.epaySign(query, cfg.key)) return 'fail';
    if (query.trade_status !== 'TRADE_SUCCESS') return 'fail';
    const order = await this.orders.findOne({ where: { out_trade_no: query.out_trade_no } });
    if (!order) return 'fail';
    if (order.status === 'paid') return 'success'; // 幂等：重复回调
    order.status = 'paid';
    order.trade_no = query.trade_no || '';
    order.paid_at = this.helpers.nowSql();
    await this.orders.save(order);
    await this.helpers.award(order.user_id, { points: order.points });
    await this.helpers
      .notify({ userId: order.user_id, type: 'system', preview: `充值成功，到账 ${order.points} 积分` })
      .catch(() => undefined);
    return 'success';
  }

  async myOrders(user: User) {
    const rows = await this.orders.find({
      where: { user_id: user.id },
      order: { id: 'DESC' },
      take: 20,
    });
    return {
      orders: rows.map((o) => ({
        outTradeNo: o.out_trade_no,
        amount: o.amount,
        points: o.points,
        status: o.status,
        channel: o.channel,
        createdAt: o.created_at,
      })),
    };
  }
}
