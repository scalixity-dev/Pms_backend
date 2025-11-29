import { Test, TestingModule } from '@nestjs/testing';
import { ServiceProviderController } from './service-provider.controller';
import { ServiceProviderService } from './service-provider.service';

describe('ServiceProviderController', () => {
  let controller: ServiceProviderController;

  beforeEach(async () => {
    const mockServiceProviderService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceProviderController],
      providers: [
        {
          provide: ServiceProviderService,
          useValue: mockServiceProviderService,
        },
      ],
    }).compile();

    controller = module.get<ServiceProviderController>(
      ServiceProviderController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
