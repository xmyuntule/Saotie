import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** polls — a post may carry one poll. Mirrors db.js. */
@Entity('polls')
@Index('idx_polls_post', ['post_id'])
export class Poll {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'post_id', type: 'int' })
  post_id: number;

  @Column({ type: 'smallint', default: 0 })
  multi: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  deadline: string | null;

  @Column({ name: 'total_votes', type: 'int', default: 0 })
  total_votes: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** poll_options — 2-6 options per poll. */
@Entity('poll_options')
@Index('idx_poll_options_poll', ['poll_id'])
export class PollOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'poll_id', type: 'int' })
  poll_id: number;

  @Column({ type: 'varchar', length: 80 })
  text: string;

  @Column({ type: 'int', default: 0 })
  votes: number;

  @Column({ type: 'int', default: 0 })
  idx: number;
}

/** poll_votes — composite PK (poll_id, option_id, user_id). */
@Entity('poll_votes')
@Index('idx_poll_votes_lookup', ['poll_id', 'user_id'])
export class PollVote {
  @PrimaryColumn({ name: 'poll_id', type: 'int' })
  poll_id: number;

  @PrimaryColumn({ name: 'option_id', type: 'int' })
  option_id: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
