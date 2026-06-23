import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** admin_audit_log — 管理操作日志。Mirrors db.js admin_audit_log. */
@Entity('admin_audit_log')
@Index('idx_audit_created', ['created_at'])
export class AdminLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int' })
  admin_id: number;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32, default: '' })
  target_type: string;

  @Column({ name: 'target_id', type: 'int', nullable: true })
  target_id: number | null;

  @Column({ name: 'detail', type: 'varchar', length: 300, default: '' })
  detail: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
