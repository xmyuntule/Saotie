import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PayService } from './pay.service';

/** /api/pay — 充值支付（易支付 epay 端到端）。notify/return 由网关回调，无需登录（靠签名验真）。 */
@Controller('api/pay')
export class PayController {
  constructor(private readonly pay: PayService) {}

  private baseUrl(req: Request): string {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    return `${proto}://${host}`;
  }

  @Post('epay/create')
  @UseGuards(JwtAuthGuard)
  createEpay(
    @CurrentUser() user: User,
    @Body() body: { amount?: number; channel?: string },
    @Req() req: Request,
  ) {
    return this.pay.createEpay(user, body?.amount, body?.channel || 'alipay', this.baseUrl(req));
  }

  // 异步回调：epay 多以 GET 通知，少数 POST；两者都收。须返回字面量 "success"
  @Get('epay/notify')
  epayNotifyGet(@Query() query: Record<string, string>) {
    return this.pay.handleEpayNotify(query);
  }

  @Post('epay/notify')
  epayNotifyPost(@Query() query: Record<string, string>, @Body() body: Record<string, string>) {
    return this.pay.handleEpayNotify({ ...(body || {}), ...(query || {}) });
  }

  // 用户支付完成后跳回前台
  @Get('epay/return')
  epayReturn(@Res() res: Response) {
    res.redirect('/member?recharge=ok');
  }

  // ---- 支付宝官方直连（RSA2）----
  @Post('alipay/create')
  @UseGuards(JwtAuthGuard)
  createAlipay(
    @CurrentUser() user: User,
    @Body() body: { amount?: number },
    @Req() req: Request,
  ) {
    return this.pay.createAlipay(user, body?.amount, this.baseUrl(req));
  }

  // 支付宝异步回调以 POST 表单通知；须返回字面量 "success"
  @Post('alipay/notify')
  alipayNotify(@Body() body: Record<string, string>, @Query() query: Record<string, string>) {
    return this.pay.handleAlipayNotify({ ...(query || {}), ...(body || {}) });
  }

  @Get('alipay/return')
  alipayReturn(@Res() res: Response) {
    res.redirect('/member?recharge=ok');
  }

  // ---- 微信支付 v3 · Native 扫码 ----
  @Post('wechat/create')
  @UseGuards(JwtAuthGuard)
  createWechat(
    @CurrentUser() user: User,
    @Body() body: { amount?: number },
    @Req() req: Request,
  ) {
    return this.pay.createWechat(user, body?.amount, this.baseUrl(req));
  }

  // 微信异步回调（POST JSON，资源 AES-GCM 加密）；返回 { code:'SUCCESS' } 停止重试
  @Post('wechat/notify')
  wechatNotify(@Body() body: any) {
    return this.pay.handleWechatNotify(body);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  myOrders(@CurrentUser() user: User) {
    return this.pay.myOrders(user);
  }

  // 管理员：查看全部充值订单
  @Get('admin/orders')
  @UseGuards(JwtAuthGuard)
  adminOrders(@CurrentUser() user: User) {
    return this.pay.adminOrders(user);
  }
}
