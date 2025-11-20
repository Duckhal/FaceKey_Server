import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccesslogsService } from './accesslogs.service';
import { AccesslogsController } from './accesslogs.controller';
import { AccessLog } from './entities/accesslog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog])],
  controllers: [AccesslogsController],
  providers: [AccesslogsService],
})
export class AccesslogsModule {}
