import { Column, Entity, PrimaryColumn } from 'typeorm';

/** checkin_log — 每日签到记录。Mirrors db.js checkin_log（PK: user_id + date）。 */
@Entity('checkin_log')
export class CheckinLog {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  date: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'smallint', default: 0 })
  makeup: number;
}
