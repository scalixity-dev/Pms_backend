import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceRequestController } from './maintenance-request.controller';
import { MaintenanceRequestService } from './maintenance-request.service';

describe('MaintenanceRequestController', () => {
  let controller: MaintenanceRequestController;

  beforeEach(async () => {
    const mockMaintenanceRequestService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceRequestController],
      providers: [
        {
          provide: MaintenanceRequestService,
          useValue: mockMaintenanceRequestService,
        },
      ],
    }).compile();

    controller = module.get<MaintenanceRequestController>(
      MaintenanceRequestController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
