import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddCertificationApplications1784300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'cert_type',
        type: 'varchar',
        length: '16',
        default: "''",
      }),
      new TableColumn({
        name: 'cert_label',
        type: 'varchar',
        length: '32',
        default: "''",
      }),
      new TableColumn({
        name: 'cert_approved_at',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'certification_applications',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'user_id', type: 'int' },
          { name: 'type', type: 'varchar', length: '16' },
          { name: 'label', type: 'varchar', length: '32', default: "''" },
          { name: 'real_name', type: 'varchar', length: '64', default: "''" },
          { name: 'contact', type: 'varchar', length: '64', default: "''" },
          { name: 'company_name', type: 'varchar', length: '128', default: "''" },
          { name: 'company_info', type: 'text', isNullable: true },
          { name: 'proof_files_json', type: 'text', isNullable: true },
          { name: 'license_file_json', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '16', default: "'pending'" },
          { name: 'review_note', type: 'varchar', length: '255', default: "''" },
          { name: 'reviewed_by', type: 'int', isNullable: true },
          { name: 'reviewed_at', type: 'varchar', length: '32', isNullable: true },
          { name: 'created_at', type: 'varchar', length: '32' },
          { name: 'updated_at', type: 'varchar', length: '32' },
        ],
      }),
    );

    await queryRunner.createIndices('certification_applications', [
      new TableIndex({
        name: 'idx_certification_applications_user',
        columnNames: ['user_id'],
      }),
      new TableIndex({
        name: 'idx_certification_applications_status',
        columnNames: ['status'],
      }),
      new TableIndex({
        name: 'idx_certification_applications_created',
        columnNames: ['created_at'],
      }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('certification_applications', true);
    await queryRunner.dropColumn('users', 'cert_approved_at');
    await queryRunner.dropColumn('users', 'cert_label');
    await queryRunner.dropColumn('users', 'cert_type');
  }
}
