import { Test, TestingModule } from '@nestjs/testing';
import { KeysAndLocksController } from './keys-and-locks.controller';
import { KeysAndLocksService } from './keys-and-locks.service';

describe('KeysAndLocksController', () => {
  let controller: KeysAndLocksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeysAndLocksController],
      providers: [KeysAndLocksService],
    }).compile();

    controller = module.get<KeysAndLocksController>(KeysAndLocksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
