import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MatchService } from './match.service';

type PrismaMock = {
  match: { findMany: jest.Mock; createMany: jest.Mock; findUnique: jest.Mock };
};

const buildPrismaMock = (): PrismaMock => ({
  match: { findMany: jest.fn(), createMany: jest.fn(), findUnique: jest.fn() },
});

const matchRow = {
  id: 11,
  candidateUserId: 7,
  matchedAt: new Date('2026-08-18T10:00:00.000Z'),
  offer: {
    id: 4,
    title: 'Développeur Full-Stack',
    company: { id: 8, name: 'Acme Corp', logo: 'companies/8/logo/acme.webp' },
  },
  candidate: {
    candidateProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: 'candidates/7/avatar.webp',
      desiredJobTitle: 'Développeuse',
    },
  },
};

describe('MatchService', () => {
  let service: MatchService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [MatchService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(MatchService);
  });

  it('returns a candidate’s matched company and offer', async () => {
    prisma.match.findMany.mockResolvedValue([matchRow]);

    await expect(
      service.findMine({ id: 7, userType: 'candidate' }),
    ).resolves.toEqual([
      {
        id: 11,
        matchedAt: matchRow.matchedAt,
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
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateUserId: 7, offer: { status: 'open' } },
        skip: 0,
        take: 50,
      }),
    );
  });

  it('returns only a recruiter’s own matched candidates', async () => {
    prisma.match.findMany.mockResolvedValue([matchRow]);

    const matches = await service.findMine(
      { id: 3, userType: 'recruiter' },
      { page: 3, limit: 10 },
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.counterpart).toMatchObject({
      kind: 'candidate',
      id: 7,
      name: 'Ada Lovelace',
    });
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recruiterUserId: 3, offer: { status: 'open' } },
        skip: 20,
        take: 10,
      }),
    );
  });

  it('creates exactly once and retrieves the winning match after a duplicate race', async () => {
    prisma.match.createMany.mockResolvedValue({ count: 0 });
    prisma.match.findUnique.mockResolvedValue(matchRow);

    const result = await service.tryCreateReciprocalMatch(
      prisma as never,
      7,
      4,
      3,
      'candidate',
    );

    expect(result.matchCreated).toBe(false);
    expect(result.match).toMatchObject({
      id: 11,
      counterpart: { kind: 'company' },
    });
    expect(prisma.match.createMany).toHaveBeenCalledWith({
      data: [{ candidateUserId: 7, offerId: 4, recruiterUserId: 3 }],
      skipDuplicates: true,
    });
    expect(prisma.match.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateUserId_offerId: { candidateUserId: 7, offerId: 4 } },
      }),
    );
  });
});
