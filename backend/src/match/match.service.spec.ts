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

  it('returns a recruiter’s matched candidates only from their company offers', async () => {
    const matchedAt = new Date('2026-08-18T10:00:00.000Z');
    prisma.match.findMany.mockResolvedValue([
      {
        id: 12,
        matchedAt,
        offer: { id: 4, title: 'Développeur Full-Stack' },
        candidate: {
          id: 3,
          candidateProfile: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            picture: 'candidates/3/picture/ada.webp',
            desiredJobTitle: 'Ingénieure logiciel',
          },
        },
      },
    ]);

    await expect(
      service.findMine({ id: 9, userType: 'recruiter' }),
    ).resolves.toEqual([
      {
        id: 12,
        matchedAt,
        offer: { id: 4, title: 'Développeur Full-Stack' },
        counterpart: {
          kind: 'candidate',
          id: 3,
          name: 'Ada Lovelace',
          avatarUrl: 'candidates/3/picture/ada.webp',
          headline: 'Ingénieure logiciel',
        },
      },
    ]);

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          offer: {
            company: {
              recruiter: { some: { userId: 9 } },
            },
          },
        },
        orderBy: { matchedAt: 'desc' },
      }),
    );
  });

  it('keeps a recruiter match visible when the candidate profile is unavailable', async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: 12,
        matchedAt: new Date('2026-08-18T10:00:00.000Z'),
        offer: { id: 4, title: 'Développeur Full-Stack' },
        candidate: { id: 3, candidateProfile: null },
      },
    ]);

    const [match] = await service.findMine({ id: 9, userType: 'recruiter' });

    expect(match.counterpart).toBeNull();
  });
});
