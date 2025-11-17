import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from './jwt.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            device: { findFirst: jest.fn(), create: jest.fn() },
            oTP: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
            // Add other Prisma methods as needed
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendOtpEmail: jest.fn(),
            sendDeviceVerificationEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            generateToken: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
