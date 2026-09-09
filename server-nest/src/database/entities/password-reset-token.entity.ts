import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_reset_tokens')
@Index('idx_password_reset_tokens_hash', ['token_hash'], { unique: true })
@Index('idx_password_reset_tokens_user_purpose', ['user_id', 'purpose'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 24 })
  purpose: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ name: 'expires_at', type: 'varchar', length: 32 })
  expires_at: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32 })
  created_at: string;

  @Column({ name: 'used_at', type: 'varchar', length: 32, nullable: true })
  used_at: string | null;
}
