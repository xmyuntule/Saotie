import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { RedisCacheModule } from './modules/cache/redis-cache.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';
import { AppController } from './app.controller';

/**
 * Root module. Infrastructure (config/db/redis/storage/common) loads first,
 * then the ported feature modules (auth/users/posts). Add new feature modules
 * here as they are ported — see README "Remaining modules to port".
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // reads server-nest/.env (copy from .env.example)
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    CommonModule,
    RedisCacheModule,
    StorageModule,
    AuthModule,
    UsersModule,
    PostsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
