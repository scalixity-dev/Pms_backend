import { Test, TestingModule } from '@nestjs/testing';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';

describe('LeasingController', () => {
  let controller: LeasingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeasingController],
      providers: [LeasingService],
    }).compile();

    controller = module.get<LeasingController>(LeasingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
