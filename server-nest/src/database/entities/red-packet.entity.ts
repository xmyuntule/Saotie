import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** red_packets — 动态红包(发到某条 post)。Mirrors db.js red_packets. */
@Entity('red_packets')
@Index('idx_redpacket_post', ['post_id'])
export class RedPacket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'post_id', type: 'int' })
  post_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'total_points', type: 'int' })
  total_points: number;

  @Column({ name: 'total_count', type: 'int' })
  total_count: number;

  @Column({ name: 'remaining_points', type: 'int' })
  remaining_points: number;

  @Column({ name: 'remaining_count', type: 'int' })
  remaining_count: number;

  @Column({ name: 'blessing', type: 'varchar', length: 64, default: '' })
  blessing: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** red_packet_grabs — 抢红包记录(每人每包一次)。Mirrors db.js red_packet_grabs. */
@Entity('red_packet_grabs')
@Index('idx_redpacket_grabs', ['packet_id'])
@Unique('uq_redpacket_grab', ['packet_id', 'user_id'])
export class RedPacketGrab {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'packet_id', type: 'int' })
  packet_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'amount', type: 'int' })
  amount: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
