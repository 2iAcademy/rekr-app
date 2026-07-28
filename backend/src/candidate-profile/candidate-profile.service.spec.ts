import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CandidateProfileService } from './candidate-profile.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  candidateProfile: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  tag: { createMany: jest.Mock; findMany: jest.Mock };
  candidateTag: { deleteMany: jest.Mock; createMany: jest.Mock };
  $transaction: jest.Mock;
};

const buildPrismaMock = (): PrismaMock => {
  const mock: PrismaMock = {
    candidateProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tag: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    candidateTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
};

describe('CandidateProfileService', () => {
  let service: CandidateProfileService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidateProfileService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CandidateProfileService);
  });

  describe('create', () => {
    it('persists a new profile linked to the given user', async () => {
      const dto = { firstName: 'Ada', lastName: 'Lovelace' };
      prisma.candidateProfile.findUnique.mockResolvedValue(null);
      prisma.candidateProfile.create.mockResolvedValue({
        id: 1,
        userId: 42,
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      const result = await service.create(42, dto);

      expect(prisma.candidateProfile.create).toHaveBeenCalledWith({
        data: { userId: 42, firstName: 'Ada', lastName: 'Lovelace' },
      });
      expect(result).toEqual(
        expect.objectContaining({ id: 1, userId: 42, firstName: 'Ada' }),
      );
    });

    // L5 — `data: { userId, ...profileData }` lets the payload win on a key
    // collision, so the owner of the profile would come from the request body.
    // Nothing exploits it today only because `forbidNonWhitelisted` rejects
    // unknown fields upstream: the identity key depends on a pipe option set in
    // another file. Spreading first makes the ownership structural instead.
    it('ignores a userId smuggled in the payload and keeps the caller as owner', async () => {
      const dto = { firstName: 'Mallory', lastName: 'Smith' };
      prisma.candidateProfile.findUnique.mockResolvedValue(null);
      prisma.candidateProfile.create.mockResolvedValue({ id: 2, userId: 42 });

      await service.create(42, { ...dto, userId: 999 } as typeof dto);

      expect(prisma.candidateProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 42 }) as object,
      });
    });

    it('rejects creation when the user already has a profile', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 9,
        userId: 42,
      });

      await expect(
        service.create(42, { firstName: 'Ada', lastName: 'Lovelace' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.candidateProfile.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the profile of the given user', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 42,
      });
      prisma.candidateProfile.update.mockResolvedValue({
        id: 1,
        userId: 42,
        firstName: 'Grace',
      });

      const result = await service.update(42, { firstName: 'Grace' });

      expect(prisma.candidateProfile.update).toHaveBeenCalledWith({
        where: { userId: 42 },
        data: { firstName: 'Grace' },
      });
      expect(result).toEqual(
        expect.objectContaining({ userId: 42, firstName: 'Grace' }),
      );
    });

    it('rejects update when the user has no profile', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.update(42, { firstName: 'Grace' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.candidateProfile.update).not.toHaveBeenCalled();
    });
  });
});
