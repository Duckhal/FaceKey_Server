import { Module } from '@nestjs/common';
import { AccesslogsService } from './accesslogs.service';
import { AccesslogsController } from './accesslogs.controller';

@Module({
  controllers: [AccesslogsController],
  providers: [AccesslogsService],
})
export class AccesslogsModule {}
