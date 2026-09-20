import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddPostUnlockTokens1785100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'post_unlock_tokens',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'int' },
        { name: 'post_id', type: 'int' },
        { name: 'token_hash', type: 'varchar', length: '64' },
        { name: 'expires_at', type: 'varchar', length: '32' },
        { name: 'created_at', type: 'varchar', length: '32' },
      ],
    }), true);
    await queryRunner.createIndex('post_unlock_tokens', new TableIndex({
      name: 'idx_post_unlock_tokens_hash', columnNames: ['token_hash'], isUnique: true,
    }));
    await queryRunner.createIndex('post_unlock_tokens', new TableIndex({
      name: 'idx_post_unlock_tokens_user_post', columnNames: ['user_id', 'post_id'],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('post_unlock_tokens', true);
  }
}
