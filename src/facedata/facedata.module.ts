import { Module } from '@nestjs/common';
import { FacedataService } from './facedata.service';
import { FacedataController } from './facedata.controller';

@Module({
  controllers: [FacedataController],
  providers: [FacedataService],
})
export class FacedataModule {}
