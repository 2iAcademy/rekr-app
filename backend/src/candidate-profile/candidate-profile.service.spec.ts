import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
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

  describe('findMine', () => {
    const profileRow = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      userId: 42,
      firstName: 'Ada',
      lastName: 'Lovelace',
      latitude: null,
      longitude: null,
      user: { candidateTags: [] as unknown[] },
      ...overrides,
    });

    it('rejects a read when the user has no profile', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(service.findMine(42)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    /**
     * Two properties in one assertion, both structural: the row is keyed on the
     * caller, and the only thing read off the `user` relation is the tag links —
     * `passwordHash` lives on that same row.
     */
    it('keys the read on the caller and reads nothing off the account but its tags', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(profileRow());

      await service.findMine(42);

      expect(prisma.candidateProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 42 },
          select: expect.objectContaining({
            user: {
              select: {
                candidateTags: {
                  orderBy: { tag: { label: 'asc' } },
                  select: { tag: { select: { label: true, category: true } } },
                },
              },
            },
          }) as object,
        }),
      );
    });

    it('splits the tag links into skills and languages', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(
        profileRow({
          user: {
            candidateTags: [
              { tag: { label: 'Anglais', category: 'language' } },
              { tag: { label: 'React', category: 'skill' } },
              { tag: { label: 'TypeScript', category: 'skill' } },
            ],
          },
        }),
      );

      const result = await service.findMine(42);

      expect(result.skills).toEqual(['React', 'TypeScript']);
      expect(result.languages).toEqual(['Anglais']);
    });

    // `tag_category` holds seven values and the account screen renders two of
    // them. A link in any other category belongs to neither list rather than
    // falling into whichever one is built last.
    it('drops a tag link whose category is neither a skill nor a language', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(
        profileRow({
          user: {
            candidateTags: [{ tag: { label: 'Docker', category: 'tech' } }],
          },
        }),
      );

      const result = await service.findMine(42);

      expect(result.skills).toEqual([]);
      expect(result.languages).toEqual([]);
    });

    it('renders the coordinates as strings', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(
        profileRow({
          latitude: new Prisma.Decimal('45.7580000'),
          longitude: new Prisma.Decimal('4.8350000'),
        }),
      );

      const result = await service.findMine(42);

      expect(result.latitude).toBe('45.758');
      expect(result.longitude).toBe('4.835');
    });

    it('keeps an unset coordinate null rather than stringifying it', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(profileRow());

      const result = await service.findMine(42);

      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
    });

    // The tags are read through the `user` relation, so the relation itself
    // must not ride along into the response.
    it('does not leak the relation it read the tags through', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(profileRow());

      const result = await service.findMine(42);

      expect(result).not.toHaveProperty('user');
    });
  });
});
