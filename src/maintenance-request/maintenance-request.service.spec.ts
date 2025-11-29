import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceRequestService } from './maintenance-request.service';

describe('MaintenanceRequestService', () => {
  let service: MaintenanceRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MaintenanceRequestService],
    }).compile();

    service = module.get<MaintenanceRequestService>(MaintenanceRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
