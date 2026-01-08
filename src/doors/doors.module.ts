import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Door } from './entities/door.entity';
import { DoorsService } from './doors.service';
import { DoorsController } from './doors.controller';
import { Device } from '../devices/entities/device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Door, Device])],
  controllers: [DoorsController],
  providers: [DoorsService],
  exports: [DoorsService],
})
export class DoorsModule {}
