import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** certification_applications — personal / enterprise verification workflow. */
@Entity('certification_applications')
@Index('idx_certification_applications_user', ['user_id'])
@Index('idx_certification_applications_status', ['status'])
@Index('idx_certification_applications_created', ['created_at'])
export class CertificationApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 16 })
  type: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  label: string;

  @Column({ name: 'real_name', type: 'varchar', length: 64, default: '' })
  real_name: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  contact: string;

  @Column({ name: 'company_name', type: 'varchar', length: 128, default: '' })
  company_name: string;

  @Column({ name: 'company_info', type: 'text', nullable: true })
  company_info: string | null;

  @Column({ name: 'proof_files_json', type: 'text', nullable: true })
  proof_files_json: string | null;

  @Column({ name: 'license_file_json', type: 'text', nullable: true })
  license_file_json: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  @Column({ name: 'review_note', type: 'varchar', length: 255, default: '' })
  review_note: string;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewed_by: number | null;

  @Column({ name: 'reviewed_at', type: 'varchar', length: 32, nullable: true })
  reviewed_at: string | null;

  @Column({ name: 'created_at', type: 'varchar', length: 32 })
  created_at: string;

  @Column({ name: 'updated_at', type: 'varchar', length: 32 })
  updated_at: string;
}
