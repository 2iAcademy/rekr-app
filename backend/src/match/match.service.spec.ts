import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MatchService } from './match.service';

type PrismaMock = {
  match: { findMany: jest.Mock; createMany: jest.Mock; findUnique: jest.Mock };
  recruiterProfile: { findUnique: jest.Mock };
};

const buildPrismaMock = (): PrismaMock => ({
  match: { findMany: jest.fn(), createMany: jest.fn(), findUnique: jest.fn() },
  recruiterProfile: { findUnique: jest.fn() },
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

  it('returns the matched candidates of the recruiter’s company', async () => {
    prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
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
    expect(prisma.recruiterProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 3 },
      select: { companyId: true },
    });
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          offer: { status: 'open', companyId: 8 },
          candidate: { isActive: true, candidateProfile: { isNot: null } },
        },
        skip: 20,
        take: 10,
      }),
    );
    const [args] = prisma.match.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where).not.toHaveProperty('recruiterUserId');
  });

  it('returns an empty list for a recruiter without a company', async () => {
    prisma.recruiterProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.findMine({ id: 3, userType: 'recruiter' }),
    ).resolves.toEqual([]);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  /**
   * Ex aequo are reachable — Prisma stamps `matchedAt` client-side, to the
   * millisecond — and past a few hundred rows Postgres answers a paginated
   * `ORDER BY matched_at DESC` with an unstable top-N heapsort: two OFFSETs
   * disagree on the order of the ties, so a row comes back twice while
   * another is never served. Only a unique second key rules that out.
   */
  it.each([
    ['candidate' as const, 7],
    ['recruiter' as const, 3],
  ])('breaks %s ties on a unique key', async (userType, userId) => {
    prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
    prisma.match.findMany.mockResolvedValue([]);

    await service.findMine({ id: userId, userType });

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ matchedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  /**
   * Same rule as `findApplicants` and `/likes/received`: a deactivated account
   * or a signup that never reached the profile wizard has nothing to show, and
   * the row would open a screen the candidate is absent from.
   */
  it('excludes deactivated and profile-less candidates for a recruiter', async () => {
    prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
    prisma.match.findMany.mockResolvedValue([]);

    await service.findMine({ id: 3, userType: 'recruiter' });

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          offer: { status: 'open', companyId: 8 },
          candidate: { isActive: true, candidateProfile: { isNot: null } },
        },
      }),
    );
  });

  /**
   * The candidate branch stays as it is: its counterpart is a company, gated
   * by `offer.status`, and the row's own account is already known active — the
   * guard refuses a deactivated token. Mirroring the recruiter predicate here
   * would hide a candidate's own matches while they finish their profile.
   */
  it('does not filter a candidate on their own profile', async () => {
    prisma.match.findMany.mockResolvedValue([]);

    await service.findMine({ id: 7, userType: 'candidate' });

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateUserId: 7, offer: { status: 'open' } },
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
