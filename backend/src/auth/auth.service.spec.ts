import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(false),
}));

const compareMock = bcrypt.compare as unknown as jest.Mock;

describe('AuthService.login — enumeration hardening', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    compareMock.mockClear();
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token') } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  /**
   * The timing oracle: returning early on an unknown e-mail answers in a few
   * milliseconds, while a known e-mail pays a full bcrypt round. The identical
   * 401 body hides nothing if the response time gives the answer away.
   */
  it('still spends a bcrypt comparison when the e-mail is unknown', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'ghost@test.dev', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compareMock).toHaveBeenCalledTimes(1);
    // The compared value is the SHA-256 pre-hash, not the raw password — the
    // decoy path must fold the input exactly like the real one, otherwise the
    // two branches would not cost the same and the oracle would reopen.
    expect(compareMock).toHaveBeenCalledWith(
      createHash('sha256').update('whatever', 'utf8').digest('base64'),
      expect.stringMatching(/^\$2[aby]\$/),
    );
  });

  it('returns the same error as a wrong password on an existing account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'known@test.dev',
      passwordHash: 'stored',
      isActive: true,
    });

    const known = await service
      .login({ email: 'known@test.dev', password: 'wrong' })
      .catch((error: UnauthorizedException) => error);
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await service
      .login({ email: 'ghost@test.dev', password: 'wrong' })
      .catch((error: UnauthorizedException) => error);

    expect((known as UnauthorizedException).message).toBe(
      (unknown as UnauthorizedException).message,
    );
  });
});
