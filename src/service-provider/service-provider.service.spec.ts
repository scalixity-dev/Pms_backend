import { Test, TestingModule } from '@nestjs/testing';
import { ServiceProviderService } from './service-provider.service';

describe('ServiceProviderService', () => {
  let service: ServiceProviderService;

  beforeEach(async () => {
    const mockPrismaService = {
      serviceProvider: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      maintenanceAssignment: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceProviderService,
        {
          provide: 'PrismaService',
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ServiceProviderService>(ServiceProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
