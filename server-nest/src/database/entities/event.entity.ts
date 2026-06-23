import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** events — 社区活动。Mirrors db.js events. */
@Entity('events')
@Index('idx_events_start', ['start_at'])
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  cover: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  location: string;

  @Column({ type: 'varchar', length: 32, default: '聚会' })
  category: string;

  @Column({ name: 'start_at', type: 'varchar', length: 32 })
  start_at: string;

  @Column({ name: 'end_at', type: 'varchar', length: 32, default: '' })
  end_at: string;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'int', default: 0 })
  fee: number;

  @Column({ type: 'smallint', default: 0 })
  online: number;

  @Column({ name: 'signup_count', type: 'int', default: 0 })
  signup_count: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** event_signups — 活动报名。Mirrors db.js event_signups. */
@Entity('event_signups')
@Unique('uq_event_signup', ['event_id', 'user_id'])
@Index('idx_event_signups', ['event_id'])
export class EventSignup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_id', type: 'int' })
  event_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
