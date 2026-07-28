import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    // `/debug-sentry` is guarded by JwtAuthGuard now, and Nest instantiates the
    // guards of a controller when the module is compiled — hence the two stubs.
    // They are never called: this suite only exercises the unguarded root route.
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
