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
