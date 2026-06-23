import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** lottery_prizes — 抽奖奖池(8 格)。Mirrors db.js lottery_prizes. */
@Entity('lottery_prizes')
export class LotteryPrize {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  type: string; // points | title | frame | thanks

  @Column({ type: 'varchar', length: 128, default: '' })
  value: string;

  @Column({ type: 'varchar', length: 32, default: 'gift' })
  icon: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  color: string;

  @Column({ type: 'int', default: 10 })
  weight: number;

  @Column({ type: 'int', default: 0 })
  position: number;
}

/** lottery_draws — 抽奖记录。Mirrors db.js lottery_draws. */
@Entity('lottery_draws')
export class LotteryDraw {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'prize_id', type: 'int' })
  prize_id: number;

  @Column({ name: 'prize_name', type: 'varchar', length: 64, default: '' })
  prize_name: string;

  @Column({ name: 'prize_type', type: 'varchar', length: 32, default: '' })
  prize_type: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
