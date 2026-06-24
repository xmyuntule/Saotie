import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavCategory, NavLink, UserNavLink } from '../../database/entities';
import { NavController } from './nav.controller';
import { NavService } from './nav.service';

@Module({
  imports: [TypeOrmModule.forFeature([NavCategory, NavLink, UserNavLink])],
  controllers: [NavController],
  providers: [NavService],
})
export class NavModule {}
