import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from './entities';

const client = (process.env.DB_CLIENT || 'mysql').toLowerCase();
const isPostgres = client === 'postgres' || client === 'postgresql';

export default new DataSource({
  type: isPostgres ? 'postgres' : 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || (isPostgres ? '5432' : '3306'), 10),
  username: process.env.DB_USER || 'hahasns',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hahasns',
  entities,
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
