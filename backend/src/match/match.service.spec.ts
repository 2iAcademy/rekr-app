import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MatchService } from './match.service';

type PrismaMock = {
  match: { findMany: jest.Mock };
};

const buildPrismaMock = (): PrismaMock => ({
  match: { findMany: jest.fn() },
});

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

  it('returns a candidate’s matched companies and offers, newest first', async () => {
    const matchedAt = new Date('2026-08-18T10:00:00.000Z');
    prisma.match.findMany.mockResolvedValue([
      {
        id: 11,
        matchedAt,
        offer: {
          id: 4,
          title: 'Développeur Full-Stack',
          company: {
            id: 8,
            name: 'Acme Corp',
            logo: 'companies/8/logo/acme.webp',
          },
        },
      },
    ]);

    await expect(
      service.findMine({ id: 7, userType: 'candidate' }),
    ).resolves.toEqual([
      {
        id: 11,
        matchedAt,
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
        where: {
          candidateUserId: 7,
          offer: { status: 'open' },
        },
        orderBy: { matchedAt: 'desc' },
        skip: 0,
        take: 50,
      }),
    );
  });

  /**
   * Scoped on the caller, whatever the query asks. The pagination is read from
   * the DTO but the candidate never is: a match list is only ever the caller's
   * own, and the recruiter branch this method used to carry is gone with the
   * screen it served.
   */
  it('reads the matches of the caller and of nobody else', async () => {
    prisma.match.findMany.mockResolvedValue([]);

    await service.findMine(
      { id: 7, userType: 'candidate' },
      { page: 3, limit: 10 },
    );

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateUserId: 7, offer: { status: 'open' } },
        skip: 20,
        take: 10,
      }),
    );
  });
});
