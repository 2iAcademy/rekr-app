import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MatchService } from './match.service';

type PrismaMock = {
  match: {
    findMany: jest.Mock;
    createMany: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
  recruiterProfile: { findUnique: jest.Mock };
  candidateLikesOffer: { deleteMany: jest.Mock };
  recruiterLikesCandidate: { deleteMany: jest.Mock };
  candidatePassesOffer: { createMany: jest.Mock };
  recruiterPassesCandidate: { createMany: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
};

const buildPrismaMock = (): PrismaMock => {
  const prisma: PrismaMock = {
    match: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    recruiterProfile: { findUnique: jest.fn() },
    candidateLikesOffer: { deleteMany: jest.fn() },
    recruiterLikesCandidate: { deleteMany: jest.fn() },
    candidatePassesOffer: { createMany: jest.fn() },
    recruiterPassesCandidate: { createMany: jest.fn() },
    $executeRaw: jest.fn(),
    // The interactive form, so the assertions below observe the very writes
    // the handler issues on its transaction client.
    $transaction: jest.fn(
      (run: (tx: PrismaMock) => Promise<unknown>) => run(prisma) as unknown,
    ),
  };
  return prisma;
};

/** The pair and the parties `unmatch` decides on, as its reads project them. */
const unmatchRow = {
  id: 11,
  candidateUserId: 7,
  offerId: 4,
  recruiterUserId: 3,
  offer: { companyId: 8 },
};

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

  describe('unmatch', () => {
    /**
     * Deleting the match alone would resurrect the like: `/likes/sent` and
     * `/likes/received` hide a pair by the existence of the match, not by the
     * like, so the row reappears on both screens the moment the match goes.
     * The candidate pass is what keeps the offer from walking straight back
     * into the feed the pair was just removed from.
     */
    it('tears the whole answer trail of the pair down for the candidate', async () => {
      prisma.match.findUnique.mockResolvedValue(unmatchRow);
      prisma.match.delete.mockResolvedValue(unmatchRow);

      await expect(
        service.unmatch({ id: 7, userType: 'candidate' }, 11),
      ).resolves.toBeUndefined();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.match.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 11 } }),
      );
      expect(prisma.candidateLikesOffer.deleteMany).toHaveBeenCalledWith({
        where: { candidateUserId: 7, offerId: 4 },
      });
      // Every recruiter of the company, not just the one who concluded:
      // `recruiter_likes_candidate` is keyed on the recruiter too, and a
      // colleague's surviving like would re-create the match on the next like.
      expect(prisma.recruiterLikesCandidate.deleteMany).toHaveBeenCalledWith({
        where: { candidateUserId: 7, offerId: 4 },
      });
      expect(prisma.candidatePassesOffer.createMany).toHaveBeenCalledWith({
        data: [{ candidateUserId: 7, offerId: 4 }],
        skipDuplicates: true,
      });
    });

    /**
     * `recruiter_passes_candidate` is read twice over — `/likes/received`
     * filters on it per recruiter, and `findApplicants` serves it as
     * `recruiterPassedAt`, which the applicants screen reads as that
     * recruiter's own decision. A pass written here would credit someone with a
     * refusal they never pronounced, since the candidate may be the one who
     * ended the match, and nothing purges it afterwards: `likeApplicant` has no
     * counterpart to the `candidatePassesOffer` delete `like` performs, so the
     * candidate's next application would stay invisible to that recruiter while
     * their colleagues see it.
     */
    it('records no recruiter pass, whoever ends the match', async () => {
      prisma.match.findUnique.mockResolvedValue(unmatchRow);
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
      prisma.match.delete.mockResolvedValue(unmatchRow);

      await service.unmatch({ id: 7, userType: 'candidate' }, 11);
      await service.unmatch({ id: 99, userType: 'recruiter' }, 11);

      expect(prisma.candidatePassesOffer.createMany).toHaveBeenCalledTimes(2);
      expect(prisma.recruiterPassesCandidate.createMany).not.toHaveBeenCalled();
    });

    /**
     * Same scope rule as `findMine` and `assertOwnedOffer`: the company, not
     * whoever concluded the match. A recruiter who reads the row on their
     * matches tab must be able to act on it, colleague's match or not.
     */
    it('lets a recruiter of the owning company undo a colleague’s match', async () => {
      prisma.match.findUnique.mockResolvedValue(unmatchRow);
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });
      prisma.match.delete.mockResolvedValue(unmatchRow);

      await service.unmatch({ id: 99, userType: 'recruiter' }, 11);

      expect(prisma.match.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 11 } }),
      );
      expect(prisma.recruiterProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 99 },
        select: { companyId: true },
      });
    });

    /**
     * One answer for « no such match » and « not yours »: a 403 on someone
     * else's match confirms the id exists, which is the whole of what an
     * enumeration needs — the convention `assertOwnedOffer` already sets.
     *
     * And nothing is locked on the way out. The lock is keyed on the pair, so
     * taking it for a caller who turns out to have no business with the match
     * would let a stranger serialise the writes of the two people it belongs
     * to.
     */
    it.each([
      [
        'another candidate',
        { id: 999, userType: 'candidate' as const },
        null as { companyId: number } | null,
      ],
      [
        'a recruiter of another company',
        { id: 99, userType: 'recruiter' as const },
        { companyId: 42 },
      ],
      [
        'a recruiter without a company',
        { id: 99, userType: 'recruiter' as const },
        null as { companyId: number } | null,
      ],
    ])(
      'answers 404 to %s, without locking the pair',
      async (_label, user, profile) => {
        prisma.match.findUnique.mockResolvedValue(unmatchRow);
        prisma.recruiterProfile.findUnique.mockResolvedValue(profile);

        await expect(service.unmatch(user, 11)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
        expect(prisma.match.findUnique).toHaveBeenCalledTimes(1);
        expect(prisma.match.delete).not.toHaveBeenCalled();
        expect(prisma.candidatePassesOffer.createMany).not.toHaveBeenCalled();
      },
    );

    it('answers 404 on an unknown match', async () => {
      prisma.match.findUnique.mockResolvedValue(null);

      await expect(
        service.unmatch({ id: 7, userType: 'candidate' }, 11),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.match.delete).not.toHaveBeenCalled();
    });

    /**
     * The order is the whole of the lock's value: taken after the read it is
     * meant to protect, it guards nothing. Counting the calls cannot see that
     * — a lock moved past the second read leaves every count untouched — so
     * the assertion is on the order the calls were made in.
     */
    it('takes the lock before the read the teardown rests on', async () => {
      prisma.match.findUnique.mockResolvedValue(unmatchRow);
      prisma.match.delete.mockResolvedValue(unmatchRow);

      await service.unmatch({ id: 7, userType: 'candidate' }, 11);

      const [scopeRead, heldRead] =
        prisma.match.findUnique.mock.invocationCallOrder;
      const [lock] = prisma.$executeRaw.mock.invocationCallOrder;
      expect(scopeRead).toBeLessThan(lock);
      expect(lock).toBeLessThan(heldRead);
      expect(heldRead).toBeLessThan(
        prisma.match.delete.mock.invocationCallOrder[0],
      );
    });

    /**
     * The pair is only known once the row has been read, so the first read
     * cannot be protected by the lock it derives the key from. The row is
     * therefore read again under the lock, and a match that disappeared in
     * between — two concurrent unmatches, a cascading deletion — answers 404
     * rather than having a teardown written for a match that no longer exists.
     */
    it('answers 404 when the match vanishes under the lock', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce(unmatchRow)
        .mockResolvedValueOnce(null);

      await expect(
        service.unmatch({ id: 7, userType: 'candidate' }, 11),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.match.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.match.delete).not.toHaveBeenCalled();
    });
  });
});
