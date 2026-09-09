import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddPasswordResetTokens1785000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({ name: 'email_verified', type: 'smallint', default: 0 }));
    await queryRunner.createTable(new Table({
      name: 'password_reset_tokens',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'int' },
        { name: 'purpose', type: 'varchar', length: '24' },
        { name: 'token_hash', type: 'varchar', length: '64' },
        { name: 'expires_at', type: 'varchar', length: '32' },
        { name: 'created_at', type: 'varchar', length: '32' },
        { name: 'used_at', type: 'varchar', length: '32', isNullable: true },
      ],
    }), true);
    await queryRunner.createIndex('password_reset_tokens', new TableIndex({
      name: 'idx_password_reset_tokens_hash', columnNames: ['token_hash'], isUnique: true,
    }));
    await queryRunner.createIndex('password_reset_tokens', new TableIndex({
      name: 'idx_password_reset_tokens_user_purpose', columnNames: ['user_id', 'purpose'],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_reset_tokens', true);
    await queryRunner.dropColumn('users', 'email_verified');
  }
}
