import { Column, Entity, PrimaryColumn } from 'typeorm';

/** user_badges — unlocked achievement badges. Composite PK. Mirrors db.js. */
@Entity('user_badges')
export class UserBadge {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'badge_key', type: 'varchar', length: 32 })
  badge_key: string;

  @Column({ name: 'unlocked_at', type: 'varchar', length: 32, nullable: true })
  unlocked_at: string;
}

/** task_claims — daily/once task reward claims. Composite PK. Mirrors db.js. */
@Entity('task_claims')
export class TaskClaim {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'task_key', type: 'varchar', length: 32 })
  task_key: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  ymd: string;

  @Column({ name: 'claimed_at', type: 'varchar', length: 32, nullable: true })
  claimed_at: string;
}
