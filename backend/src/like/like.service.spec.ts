import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LikeService } from './like.service';

type PrismaMock = {
  candidateLikesOffer: { findMany: jest.Mock };
  recruiterProfile: { findUnique: jest.Mock };
  $queryRaw: jest.Mock;
};

const buildPrismaMock = (): PrismaMock => ({
  candidateLikesOffer: { findMany: jest.fn() },
  recruiterProfile: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
});

const sentRow = {
  offerId: 4,
  likedAt: new Date('2026-08-18T10:00:00.000Z'),
  offer: {
    id: 4,
    title: 'Développeur Full-Stack',
    company: { id: 8, name: 'Acme Corp', logo: 'companies/8/logo/acme.webp' },
  },
};

const receivedRow = {
  candidateUserId: 7,
  offerId: 4,
  likedAt: new Date('2026-08-18T10:00:00.000Z'),
  offerTitle: 'Développeur Full-Stack',
  firstName: 'Ada',
  picture: 'candidates/7/avatar.webp',
  desiredJobTitle: 'Développeuse',
};

describe('LikeService', () => {
  let service: LikeService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [LikeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LikeService);
  });

  describe('findSent', () => {
    it('returns the company behind each offer the candidate liked', async () => {
      prisma.candidateLikesOffer.findMany.mockResolvedValue([sentRow]);

      await expect(
        service.findSent({ id: 7, userType: 'candidate' }),
      ).resolves.toEqual([
        {
          offerId: 4,
          candidateUserId: null,
          likedAt: sentRow.likedAt,
          offer: { id: 4, title: 'Développeur Full-Stack' },
          counterpart: {
            kind: 'company',
            id: 8,
            name: 'Acme Corp',
            avatarUrl: 'companies/8/logo/acme.webp',
            headline: 'Développeur Full-Stack',
          },
        },
      ]);
    });

    it('excludes matched and closed offers through the where clause', async () => {
      prisma.candidateLikesOffer.findMany.mockResolvedValue([]);

      await service.findSent({ id: 7, userType: 'candidate' });

      expect(prisma.candidateLikesOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            candidateUserId: 7,
            offer: {
              status: 'open',
              matches: { none: { candidateUserId: 7 } },
            },
          },
          orderBy: [{ likedAt: 'desc' }, { offerId: 'desc' }],
          skip: 0,
          take: 50,
        }),
      );
    });

    it('paginates with skip and take', async () => {
      prisma.candidateLikesOffer.findMany.mockResolvedValue([]);

      await service.findSent(
        { id: 7, userType: 'candidate' },
        {
          page: 3,
          limit: 10,
        },
      );

      expect(prisma.candidateLikesOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findReceived', () => {
    it('returns the candidate behind each like on a company offer', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
      prisma.$queryRaw.mockResolvedValue([receivedRow]);

      await expect(
        service.findReceived({ id: 3, userType: 'recruiter' }),
      ).resolves.toEqual([
        {
          offerId: 4,
          candidateUserId: 7,
          likedAt: receivedRow.likedAt,
          offer: { id: 4, title: 'Développeur Full-Stack' },
          counterpart: {
            kind: 'candidate',
            id: 7,
            name: 'Ada',
            avatarUrl: 'candidates/7/avatar.webp',
            headline: 'Développeuse',
          },
        },
      ]);
    });

    /**
     * The surname is not trimmed from the payload, it is never read: a column
     * left in the `SELECT` is a column that has already left the database, and
     * the next mapper to spread the row puts it back on the wire.
     */
    it('never claims the surname from the database', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
      prisma.$queryRaw.mockResolvedValue([]);

      await service.findReceived({ id: 3, userType: 'recruiter' });

      const [query] = prisma.$queryRaw.mock.calls[0] as [{ sql: string }];
      expect(query.sql).not.toContain('last_name');
    });

    it('scopes the read to the company and the caller, and paginates in SQL', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
      prisma.$queryRaw.mockResolvedValue([]);

      await service.findReceived(
        { id: 3, userType: 'recruiter' },
        {
          page: 3,
          limit: 10,
        },
      );

      expect(prisma.recruiterProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 3 } }),
      );
      const [query] = prisma.$queryRaw.mock.calls[0] as [
        { values: unknown[]; sql: string },
      ];
      expect(query.values).toEqual([8, 3, 10, 20]);
    });

    it('rejects a recruiter attached to no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findReceived({ id: 3, userType: 'recruiter' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
