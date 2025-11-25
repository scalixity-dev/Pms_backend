import { Test, TestingModule } from '@nestjs/testing';
import { LeasingService } from './leasing.service';

describe('LeasingService', () => {
  let service: LeasingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeasingService],
    }).compile();

    service = module.get<LeasingService>(LeasingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
