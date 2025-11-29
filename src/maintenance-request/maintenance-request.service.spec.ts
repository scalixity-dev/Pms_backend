import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceRequestService } from './maintenance-request.service';

describe('MaintenanceRequestService', () => {
  let service: MaintenanceRequestService;

  beforeEach(async () => {
    const mockPrismaService = {
      maintenanceRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MaintenanceRequestService,
          {
            provide: 'PrismaService',
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service = module.get<MaintenanceRequestService>(MaintenanceRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
