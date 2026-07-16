import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('asset_logs')
@Index('idx_asset_logs_user_created', ['user_id', 'created_at'])
export class AssetLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'asset_type', type: 'varchar', length: 16 })
  asset_type: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'balance_after', type: 'int', nullable: true })
  balance_after: number | null;

  @Column({ type: 'varchar', length: 160, default: '' })
  reason: string;

  @Column({ name: 'ref_type', type: 'varchar', length: 48, default: '' })
  ref_type: string;

  @Column({ name: 'ref_id', type: 'int', nullable: true })
  ref_id: number | null;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
