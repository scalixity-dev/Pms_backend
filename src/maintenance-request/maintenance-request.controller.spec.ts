import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceRequestController } from './maintenance-request.controller';
import { MaintenanceRequestService } from './maintenance-request.service';

describe('MaintenanceRequestController', () => {
  let controller: MaintenanceRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceRequestController],
      providers: [MaintenanceRequestService],
    }).compile();

    controller = module.get<MaintenanceRequestController>(MaintenanceRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
