import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** questions — 问答/悬赏求助. Mirrors db.js. */
@Entity('questions')
@Index('idx_questions_status', ['status', 'created_at'])
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'varchar', length: 32, default: '综合' })
  category: string;

  @Column({ type: 'int', default: 0 })
  bounty: number;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ name: 'best_answer_id', type: 'int', nullable: true })
  best_answer_id: number | null;

  @Column({ name: 'answer_count', type: 'int', default: 0 })
  answer_count: number;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  view_count: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** answers — Q&A answers. Mirrors db.js. */
@Entity('answers')
@Index('idx_answers_question', ['question_id'])
export class Answer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'question_id', type: 'int' })
  question_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'vote_count', type: 'int', default: 0 })
  vote_count: number;

  @Column({ type: 'smallint', default: 0 })
  accepted: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** answer_votes — composite PK (answer_id, user_id). Mirrors db.js. */
@Entity('answer_votes')
export class AnswerVote {
  @PrimaryColumn({ name: 'answer_id', type: 'int' })
  answer_id: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;
}
