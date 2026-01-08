import { Test, TestingModule } from '@nestjs/testing';
import { DoorsController } from './doors.controller';
import { DoorsService } from './doors.service';

describe('DoorsController', () => {
  let controller: DoorsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoorsController],
      providers: [DoorsService],
    }).compile();

    controller = module.get<DoorsController>(DoorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
