import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavCategory, NavLink } from '../../database/entities';
import { NavController } from './nav.controller';
import { NavService } from './nav.service';

@Module({
  imports: [TypeOrmModule.forFeature([NavCategory, NavLink])],
  controllers: [NavController],
  providers: [NavService],
})
export class NavModule {}
