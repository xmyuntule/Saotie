import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** payment_orders — 充值订单（易支付等网关）。out_trade_no 为我方订单号，回调按它对账。 */
@Entity('payment_orders')
@Index('idx_pay_out_trade', ['out_trade_no'], { unique: true })
@Index('idx_pay_user', ['user_id'])
export class PaymentOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'out_trade_no', type: 'varchar', length: 40 })
  out_trade_no: string;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 16, default: 'epay' })
  gateway: string;

  // 支付子通道：alipay / wxpay（易支付的 type 参数）
  @Column({ type: 'varchar', length: 16, default: 'alipay' })
  channel: string;

  // 金额（元，两位小数字符串，如 "1.00"）
  @Column({ type: 'varchar', length: 16 })
  amount: string;

  // 到账积分
  @Column({ type: 'int', default: 0 })
  points: number;

  // pending / paid
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  // 网关返回的交易号
  @Column({ name: 'trade_no', type: 'varchar', length: 64, default: '' })
  trade_no: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;

  @Column({ name: 'paid_at', type: 'varchar', length: 32, nullable: true })
  paid_at: string;
}
