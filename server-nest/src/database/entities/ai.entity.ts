import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** ai_conversations — AI 助手对话. Mirrors db.js. */
@Entity('ai_conversations')
@Index('idx_ai_conv_user', ['user_id', 'updated_at'])
export class AiConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 64, default: '新对话' })
  title: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;

  @Column({ name: 'updated_at', type: 'varchar', length: 32, nullable: true })
  updated_at: string;
}

/** ai_messages — AI 助手消息. Mirrors db.js. */
@Entity('ai_messages')
@Index('idx_ai_msg_conv', ['conversation_id'])
export class AiMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id', type: 'int' })
  conversation_id: number;

  @Column({ type: 'varchar', length: 16 })
  role: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}
