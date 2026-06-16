import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** messages — 私信 (direct messages). Mirrors schema.sql (+ db.js: type). */
@Entity('messages')
@Index('idx_messages_pair', ['sender_id', 'receiver_id'])
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sender_id', type: 'int' })
  sender_id: number;

  @Column({ name: 'receiver_id', type: 'int' })
  receiver_id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 16, default: 'text' })
  type: string;

  @Column({ type: 'smallint', default: 0 })
  read: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** conversation_settings — per-viewer pin/mute prefs. Composite PK. */
@Entity('conversation_settings')
export class ConversationSetting {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'peer_id', type: 'int' })
  peer_id: number;

  @Column({ type: 'smallint', default: 0 })
  pinned: number;

  @Column({ type: 'smallint', default: 0 })
  muted: number;

  @Column({ name: 'updated_at', type: 'varchar', length: 32, nullable: true })
  updated_at: string;
}
