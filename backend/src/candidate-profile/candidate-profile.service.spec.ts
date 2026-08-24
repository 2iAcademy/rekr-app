import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CandidateProfileService } from './candidate-profile.service';
import { CityService } from '../city/city.service';
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
  let cities: { assertKnown: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    cities = { assertKnown: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidateProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: CityService, useValue: cities },
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

    it('links skills and languages under their own categories', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);
      prisma.candidateProfile.create.mockResolvedValue({ id: 1, userId: 42 });
      prisma.tag.findMany
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }]);

      await service.create(42, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        skills: ['React'],
        languages: ['Anglais'],
      });

      expect(prisma.tag.createMany).toHaveBeenCalledWith({
        data: [{ label: 'React', category: 'skill' }],
        skipDuplicates: true,
      });
      expect(prisma.tag.createMany).toHaveBeenCalledWith({
        data: [{ label: 'Anglais', category: 'language' }],
        skipDuplicates: true,
      });
      expect(prisma.candidateTag.createMany).toHaveBeenCalledWith({
        data: [
          { candidateUserId: 42, tagId: 10 },
          { candidateUserId: 42, tagId: 20 },
        ],
        skipDuplicates: true,
      });
    });

    it('submits the location of the payload to the city reference', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);
      prisma.candidateProfile.create.mockResolvedValue({ id: 1, userId: 42 });

      await service.create(42, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'Lyon',
        postalCode: '69001',
      });

      expect(cities.assertKnown).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Lyon', postalCode: '69001' }),
      );
    });

    // The check runs before the transaction opens, so a refusal leaves no
    // half-created profile behind.
    it('writes nothing when the city reference refuses the location', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);
      cities.assertKnown.mockRejectedValue(new BadRequestException());

      await expect(
        service.create(42, {
          firstName: 'Ada',
          lastName: 'Lovelace',
          city: 'Wakanda',
          postalCode: '99999',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.candidateProfile.create).not.toHaveBeenCalled();
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

    it('leaves the tag links alone when the payload carries no list', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 42,
      });
      prisma.candidateProfile.update.mockResolvedValue({ id: 1, userId: 42 });

      await service.update(42, { firstName: 'Grace' });

      expect(prisma.candidateTag.deleteMany).not.toHaveBeenCalled();
    });

    it('rewrites the whole tag set, so a payload holding only languages clears the skills', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 42,
      });
      prisma.candidateProfile.update.mockResolvedValue({ id: 1, userId: 42 });
      prisma.tag.findMany.mockResolvedValueOnce([{ id: 20 }]);

      await service.update(42, { languages: ['Anglais'] });

      expect(prisma.candidateTag.deleteMany).toHaveBeenCalledWith({
        where: { candidateUserId: 42 },
      });
      expect(prisma.candidateTag.createMany).toHaveBeenCalledWith({
        data: [{ candidateUserId: 42, tagId: 20 }],
        skipDuplicates: true,
      });
    });

    // A patch may carry only one half of the pair; the other half is whatever
    // the profile already holds, and that is what has to be verified.
    it('verifies a patched city against the postcode already stored', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 42,
        city: 'Lyon',
        postalCode: '69001',
      });
      prisma.candidateProfile.update.mockResolvedValue({ id: 1, userId: 42 });

      await service.update(42, { city: 'Nîmes' });

      expect(cities.assertKnown).toHaveBeenCalledWith({
        city: 'Nîmes',
        postalCode: '69001',
      });
    });

    it('refuses a patch that would leave an unknown pair stored', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 42,
        city: 'Lyon',
        postalCode: '69001',
      });
      cities.assertKnown.mockRejectedValue(new BadRequestException());

      await expect(
        service.update(42, { postalCode: '75001' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.candidateProfile.update).not.toHaveBeenCalled();
    });

    it('does not call the reference when the patch leaves the location alone', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 42,
        city: 'Lyon',
        postalCode: '69001',
      });
      prisma.candidateProfile.update.mockResolvedValue({ id: 1, userId: 42 });

      await service.update(42, { firstName: 'Grace' });

      expect(cities.assertKnown).not.toHaveBeenCalled();
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
