import { Test, TestingModule } from '@nestjs/testing';
import { DoorsService } from './doors.service';

describe('DoorsService', () => {
  let service: DoorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DoorsService],
    }).compile();

    service = module.get<DoorsService>(DoorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
