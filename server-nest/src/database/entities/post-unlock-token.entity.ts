import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Short-lived credentials issued after a password-protected post is unlocked. */
@Entity('post_unlock_tokens')
@Index('idx_post_unlock_tokens_hash', ['token_hash'], { unique: true })
@Index('idx_post_unlock_tokens_user_post', ['user_id', 'post_id'])
export class PostUnlockToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'post_id', type: 'int' })
  post_id: number;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ name: 'expires_at', type: 'varchar', length: 32 })
  expires_at: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32 })
  created_at: string;
}
