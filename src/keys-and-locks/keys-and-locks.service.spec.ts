import { Test, TestingModule } from '@nestjs/testing';
import { KeysAndLocksService } from './keys-and-locks.service';

describe('KeysAndLocksService', () => {
  let service: KeysAndLocksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeysAndLocksService],
    }).compile();

    service = module.get<KeysAndLocksService>(KeysAndLocksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
