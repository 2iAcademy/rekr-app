import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/auth-user.interface';
import { OfferFeedQueryDto } from './dto/offer-feed-query.dto';
import { OfferService } from './offer.service';
import { CityService } from '../city/city.service';
import { PrismaService } from '../prisma/prisma.service';
import { OfferListQueryDto } from './dto/offer-list-query.dto';

type PrismaMock = {
  offer: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  recruiterProfile: { findUnique: jest.Mock };
  candidateProfile: { findUnique: jest.Mock };
  offerTag: { deleteMany: jest.Mock; createMany: jest.Mock };
  tag: { createMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const buildPrismaMock = (): PrismaMock => {
  const mock: PrismaMock = {
    offer: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    recruiterProfile: { findUnique: jest.fn() },
    candidateProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    offerTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    tag: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
};

type FeedFindManyArgs = {
  where: Record<string, unknown>;
  orderBy: unknown;
  take: number;
};

type SelectSpec = Record<string, unknown>;

type OfferFindFirstArgs = {
  where: Record<string, unknown>;
  select?: SelectSpec;
};

/**
 * Stands in for Prisma's own projection: the mock answers with the fields the
 * service claimed and nothing else, so what a payload does not carry is what
 * the `select` did not ask for. A call without a `select` gets the whole row,
 * which is what a bare `include` reads.
 */
function projectValue(value: unknown, spec: unknown): unknown {
  if (spec === true) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => projectValue(item, spec));
  }
  const nested =
    (spec as { select?: SelectSpec }).select ?? (spec as SelectSpec);
  return projectRow(value as Record<string, unknown>, nested);
}

function projectRow(
  row: Record<string, unknown>,
  select: SelectSpec,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(select)
      .filter(([field]) => field in row)
      .map(([field, spec]) => [field, projectValue(row[field], spec)]),
  );
}

describe('OfferService', () => {
  let service: OfferService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let cities: { assertKnown: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    cities = { assertKnown: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OfferService,
        { provide: PrismaService, useValue: prisma },
        { provide: CityService, useValue: cities },
      ],
    }).compile();
    service = moduleRef.get(OfferService);
  });

  describe('city verification', () => {
    it('submits the location of a new offer to the city reference', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.create.mockResolvedValue({ id: 50, companyId: 10 });

      await service.create(7, {
        title: 'Dev',
        city: 'Lyon',
        postalCode: '69001',
      });

      expect(cities.assertKnown).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Lyon', postalCode: '69001' }),
      );
    });

    it('writes nothing when the reference refuses the location of a new offer', async () => {
      cities.assertKnown.mockRejectedValue(new BadRequestException());

      await expect(
        service.create(7, {
          title: 'Dev',
          city: 'Wakanda',
          postalCode: '99999',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('verifies a patched city against the postcode already stored', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 50,
        companyId: 10,
        city: 'Lyon',
        postalCode: '69001',
      });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.update.mockResolvedValue({ id: 50, companyId: 10 });

      await service.update(7, 50, { city: 'Nîmes' });

      expect(cities.assertKnown).toHaveBeenCalledWith({
        city: 'Nîmes',
        postalCode: '69001',
      });
    });

    it('leaves the reference alone when the patch does not touch the location', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 10 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.update.mockResolvedValue({ id: 50, companyId: 10 });

      await service.update(7, 50, { title: 'Dev renommé' });

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });

    /**
     * Answering 400 on the location of an offer the caller does not own would
     * tell a stranger that the offer exists — and so would a 403. Someone
     * else's offer and a missing one give the same answer, and nothing is
     * verified until ownership is established.
     */
    it('answers 404 rather than a location error on someone else’s offer', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 50,
        companyId: 99,
        city: 'Lyon',
        postalCode: '69001',
      });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await expect(
        service.update(7, 50, { city: 'Wakanda', postalCode: '99999' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });

    it('answers 404 rather than a location error on a missing offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await expect(
        service.update(7, 50, { city: 'Wakanda', postalCode: '99999' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it("creates an offer bound to the recruiter's company", async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });
      prisma.offer.create.mockResolvedValue({ id: 50, companyId: 10 });

      const result = await service.create(7, {
        title: 'Dev Front',
        contractType: 'CDI',
      });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: {
          title: 'Dev Front',
          contractType: 'CDI',
          companyId: 10,
          createdById: 7,
        },
      });
      expect(result).toEqual(expect.objectContaining({ id: 50 }));
    });

    it('rejects create when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.create(7, { title: 'Dev Front' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.offer.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("updates an offer of the recruiter's company", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 10 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });
      prisma.offer.update.mockResolvedValue({ id: 50, title: 'Dev Senior' });

      const result = await service.update(7, 50, { title: 'Dev Senior' });

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { title: 'Dev Senior' },
      });
      expect(result).toEqual(expect.objectContaining({ id: 50 }));
    });

    // Indistinguishable from a missing offer on purpose: a 403 would confirm
    // the id exists, which is all an enumeration needs.
    it('rejects update of an offer from another company (404)', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 99 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });

      await expect(
        service.update(7, 50, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('rejects update of a missing offer (404)', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(
        service.update(7, 50, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.offer.update).not.toHaveBeenCalled();
    });
  });

  /**
   * Skills and benefits share the `offer_tag` pivot and are told apart by the
   * category of the tag they point at. Every write here therefore has to name
   * the category it owns: a wipe scoped on the offer alone would make saving
   * one list erase the other.
   */
  describe('offer tags', () => {
    const ownedOffer = (): void => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 10 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.update.mockResolvedValue({ id: 50 });
    };

    it('stores the benefits of a new offer under the benefit category', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.create.mockResolvedValue({ id: 50, companyId: 10 });
      prisma.tag.findMany.mockResolvedValue([{ id: 3 }]);

      await service.create(7, { title: 'Dev', benefits: ['Mutuelle'] });

      expect(prisma.tag.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ label: 'Mutuelle', category: 'benefit' }],
        }),
      );
      expect(prisma.offerTag.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ offerId: 50, tagId: 3 }] }),
      );
    });

    it('leaves the benefits alone when only the skills are rewritten', async () => {
      ownedOffer();
      prisma.tag.findMany.mockResolvedValue([{ id: 4 }]);

      await service.update(7, 50, { skills: ['React'] });

      expect(prisma.offerTag.deleteMany).toHaveBeenCalledWith({
        where: { offerId: 50, tag: { category: 'skill' } },
      });
      expect(prisma.offerTag.deleteMany).not.toHaveBeenCalledWith({
        where: { offerId: 50 },
      });
    });

    it('leaves the skills alone when only the benefits are rewritten', async () => {
      ownedOffer();
      prisma.tag.findMany.mockResolvedValue([{ id: 3 }]);

      await service.update(7, 50, { benefits: ['Mutuelle'] });

      expect(prisma.offerTag.deleteMany).toHaveBeenCalledWith({
        where: { offerId: 50, tag: { category: 'benefit' } },
      });
    });

    it('clears the benefits of an offer when an empty list is sent', async () => {
      ownedOffer();

      await service.update(7, 50, { benefits: [] });

      expect(prisma.offerTag.deleteMany).toHaveBeenCalledWith({
        where: { offerId: 50, tag: { category: 'benefit' } },
      });
      expect(prisma.offerTag.createMany).not.toHaveBeenCalled();
    });

    // An omitted list is not an empty one: it means « do not touch », so the
    // wipe must not run at all.
    it('touches neither list when the patch mentions no tags', async () => {
      ownedOffer();

      await service.update(7, 50, { title: 'Dev Senior' });

      expect(prisma.offerTag.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    const listQuery = (
      overrides: Partial<OfferListQueryDto> = {},
    ): OfferListQueryDto => Object.assign(new OfferListQueryDto(), overrides);

    it("lists the offers of the recruiter's company, newest first", async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.findMany.mockResolvedValue([
        { id: 50, _count: { candidateLikes: 2 } },
        { id: 49, _count: { candidateLikes: 0 } },
      ]);

      const result = await service.findMine(7, listQuery());

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 10 },
          orderBy: { createdAt: 'desc' },
        }),
      );
      // `_count` is a Prisma shape and must not reach the contract: the
      // figure travels as a plain column of the item.
      expect(result).toEqual([
        { id: 50, applicantCount: 2 },
        { id: 49, applicantCount: 0 },
      ]);
    });

    it('turns page and limit into skip and take', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await service.findMine(7, listQuery({ page: 3, limit: 20 }));

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it('narrows the list to one status when one is asked for', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await service.findMine(7, listQuery({ status: 'open' }));

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 10, status: 'open' } }),
      );
    });

    // The recruiter management screen is the one place every status shows,
    // draft and closed included, so an absent filter must not silently become
    // one.
    it('leaves every status in when no status is asked for', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await service.findMine(7, listQuery());

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 10 } }),
      );
    });

    it('rejects the list when the recruiter has no company (404)', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(service.findMine(7, listQuery())).rejects.toThrow(
        new NotFoundException('Recruiter has no company'),
      );

      expect(prisma.offer.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findFeed', () => {
    const candidate: AuthUser = { id: 7, userType: 'candidate' };

    const argsOf = (): FeedFindManyArgs =>
      (prisma.offer.findMany.mock.calls as FeedFindManyArgs[][])[0][0];

    const whereOf = (): Record<string, unknown> => argsOf().where;

    const withPreferences = (profile: {
      contractTypes?: string[];
      remotePolicy?: string | null;
    }): void => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        contractTypes: [],
        remotePolicy: null,
        ...profile,
      });
    };

    /**
     * The preferences come from the stored profile, never from the query: the
     * screen has no filter bar, and letting a caller resend them would give one
     * fact two sources.
     */
    it('reads the preferences from the profile of the caller', async () => {
      withPreferences({ contractTypes: ['CDI'] });

      await service.findFeed(candidate, new OfferFeedQueryDto());

      expect(prisma.candidateProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });

    // Two `OR` keys at the same level would overwrite each other, silently
    // dropping one of the two preferences — hence the `AND`.
    it('collects both preferences without either overwriting the other', async () => {
      withPreferences({ contractTypes: ['CDI'], remotePolicy: 'HYBRID' });

      await service.findFeed(candidate, new OfferFeedQueryDto());

      expect(whereOf().AND).toHaveLength(2);
    });

    it('narrows nothing when the profile carries no preference', async () => {
      withPreferences({});

      await service.findFeed(candidate, new OfferFeedQueryDto());

      expect(whereOf()).not.toHaveProperty('AND');
    });

    it('narrows nothing when the caller has no profile yet', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);

      await service.findFeed(candidate, new OfferFeedQueryDto());

      expect(whereOf()).not.toHaveProperty('AND');
    });

    it('keeps open offers the candidate has neither liked nor passed', async () => {
      await service.findFeed(candidate, new OfferFeedQueryDto());

      expect(whereOf()).toMatchObject({
        status: 'open',
        candidateLikes: { none: { candidateUserId: 7 } },
        candidatePasses: { none: { candidateUserId: 7 } },
      });
    });

    it('leaves out every filter the query does not carry', async () => {
      await service.findFeed(candidate, new OfferFeedQueryDto());

      const where = whereOf();
      expect(where).not.toHaveProperty('contractType');
      expect(where).not.toHaveProperty('minExperienceLevel');
      expect(where).not.toHaveProperty('remotePolicy');
      expect(where).not.toHaveProperty('city');
    });

    // `createdAt` is not unique, so the id break is what keeps two reads of
    // the deck in the same order.
    it('orders by creation date then id, and takes the deck from the top', async () => {
      await service.findFeed(candidate, {
        ...new OfferFeedQueryDto(),
        limit: 10,
      });

      expect(argsOf()).toMatchObject({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
      });
      expect(argsOf()).not.toHaveProperty('skip');
    });

    it('flattens the offer tags into their labels', async () => {
      prisma.offer.findMany.mockResolvedValue([
        {
          id: 50,
          title: 'Dev Front',
          company: { id: 10, name: 'Acme', logo: null },
          offerTags: [
            { tag: { label: 'React' } },
            { tag: { label: 'TypeScript' } },
          ],
        },
      ]);

      const result = await service.findFeed(candidate, new OfferFeedQueryDto());

      expect(result).toEqual([
        {
          id: 50,
          title: 'Dev Front',
          company: { id: 10, name: 'Acme', logo: null },
          tags: ['React', 'TypeScript'],
        },
      ]);
    });
  });

  describe('findOneById', () => {
    const candidate: AuthUser = { id: 7, userType: 'candidate' };
    const recruiter: AuthUser = { id: 7, userType: 'recruiter' };

    const CREATED_AT = new Date('2026-01-15T09:00:00.000Z');

    const offerRow = (
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      id: 50,
      companyId: 10,
      createdById: 3,
      title: 'Dev Front',
      description: 'Une offre',
      city: 'Lyon',
      postalCode: '69001',
      latitude: 45.75,
      longitude: 4.85,
      contractType: 'CDI',
      minExperienceLevel: 'SENIOR',
      remotePolicy: 'FULL_REMOTE',
      salaryMin: 40000,
      salaryMax: 55000,
      status: 'open',
      createdAt: CREATED_AT,
      updatedAt: new Date('2026-02-01T09:00:00.000Z'),
      company: {
        id: 10,
        name: 'Acme',
        logo: null,
        size: 'PME',
        description: 'Une société de service',
        city: 'Lyon',
        postalCode: '69002',
        siteUrl: 'https://acme.test',
        coverImage: null,
        sectorId: 4,
      },
      offerTags: [
        {
          offerId: 50,
          tagId: 3,
          tag: { id: 3, label: 'React', category: 'tech' },
        },
        {
          offerId: 50,
          tagId: 8,
          tag: { id: 8, label: 'Autonomie', category: 'skill' },
        },
      ],
      ...overrides,
    });

    const EXPECTED_PAYLOAD = {
      id: 50,
      title: 'Dev Front',
      description: 'Une offre',
      city: 'Lyon',
      contractType: 'CDI',
      minExperienceLevel: 'SENIOR',
      remotePolicy: 'FULL_REMOTE',
      salaryMin: 40000,
      salaryMax: 55000,
      createdAt: CREATED_AT,
      company: {
        id: 10,
        name: 'Acme',
        logo: null,
        size: 'PME',
        description: 'Une société de service',
        city: 'Lyon',
      },
      tags: [
        { label: 'React', category: 'tech' },
        { label: 'Autonomie', category: 'skill' },
      ],
    };

    const EXPECTED_SELECT = {
      id: true,
      title: true,
      description: true,
      city: true,
      contractType: true,
      minExperienceLevel: true,
      remotePolicy: true,
      salaryMin: true,
      salaryMax: true,
      createdAt: true,
      company: {
        select: {
          id: true,
          name: true,
          logo: true,
          size: true,
          description: true,
          city: true,
        },
      },
      offerTags: expect.objectContaining({
        select: { tag: { select: { label: true, category: true } } },
      }) as object,
    };

    const EXPECTED_OWNER_SELECT = {
      ...EXPECTED_SELECT,
      postalCode: true,
      status: true,
    };

    const serveRow = (row: Record<string, unknown> | null): void => {
      prisma.offer.findFirst.mockImplementation((args: OfferFindFirstArgs) => {
        if (row === null) {
          return Promise.resolve(null);
        }
        return Promise.resolve(
          args.select ? projectRow(row, args.select) : row,
        );
      });
    };

    const callsOf = (): OfferFindFirstArgs[] =>
      (prisma.offer.findFirst.mock.calls as OfferFindFirstArgs[][]).map(
        (call) => call[0],
      );

    // The payload comes from the last read: an implementation that first probes
    // the company carrying the offer still ends on the selective one.
    const argsOf = (): OfferFindFirstArgs => {
      const calls = callsOf();
      return calls[calls.length - 1];
    };

    const whereOf = (): Record<string, unknown> => callsOf()[0].where;

    it('returns the public payload of an offer to a candidate', async () => {
      serveRow(offerRow());

      const result = await service.findOneById(candidate, 50);

      expect(result).toEqual(EXPECTED_PAYLOAD);
    });

    /**
     * The postcode places the office, the status says how the company runs its
     * hiring: both belong to the recruiter screen and to no one else. The
     * database keys and the coordinates are read by no screen at all.
     */
    it('withholds the internals of the offer from a candidate', async () => {
      serveRow(offerRow());

      const result = await service.findOneById(candidate, 50);

      expect(result).not.toHaveProperty('postalCode');
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('createdById');
      expect(result).not.toHaveProperty('companyId');
      expect(result).not.toHaveProperty('latitude');
      expect(result).not.toHaveProperty('longitude');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('returns the owner payload to a recruiter of the company carrying the offer', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      serveRow(offerRow({ status: 'draft' }));

      const result = await service.findOneById(recruiter, 50);

      expect(result).toEqual({
        ...EXPECTED_PAYLOAD,
        postalCode: '69001',
        status: 'draft',
      });
    });

    /**
     * A recruiter is a stranger to every offer but their own: on someone
     * else's open offer they read what a candidate reads, and the postcode and
     * the status stay behind.
     */
    it('returns the public payload to a recruiter of another company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 99 });
      serveRow(offerRow());

      const result = await service.findOneById(recruiter, 50);

      expect(result).toEqual(EXPECTED_PAYLOAD);
      expect(result).not.toHaveProperty('postalCode');
      expect(result).not.toHaveProperty('status');
    });

    /**
     * The `select` is what actually holds the line: a payload trimmed after the
     * read would still have pulled the withheld columns out of the database,
     * and the next spread would put them back on the wire.
     */
    it('claims only the public columns when the caller does not carry the offer', async () => {
      serveRow(offerRow());

      await service.findOneById(candidate, 50);

      expect(argsOf().select).toEqual(EXPECTED_SELECT);
      expect(argsOf()).not.toHaveProperty('include');
    });

    it('claims the postcode and the status only for the company carrying the offer', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      serveRow(offerRow({ status: 'draft' }));

      await service.findOneById(recruiter, 50);

      expect(argsOf().select).toEqual(EXPECTED_OWNER_SELECT);
      expect(argsOf()).not.toHaveProperty('include');
    });

    it('flattens the offer tags into their label and category', async () => {
      serveRow(offerRow());

      const result = await service.findOneById(candidate, 50);

      expect(result).toEqual(
        expect.objectContaining({
          tags: [
            { label: 'React', category: 'tech' },
            { label: 'Autonomie', category: 'skill' },
          ],
        }),
      );
    });

    /**
     * A recruiter attached to no company reads the showcase, and the ownership
     * read is not even attempted: there is nothing to compare the offer to.
     * Pinned on the call count because that is what tells the short-circuit
     * from an ownership check that silently answered false.
     */
    it('claims the public columns without reading ownership when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);
      serveRow(offerRow());

      const result = await service.findOneById(recruiter, 50);

      expect(callsOf()).toHaveLength(1);
      expect(argsOf().select).toEqual(EXPECTED_SELECT);
      expect(result).toEqual(EXPECTED_PAYLOAD);
    });

    it('answers 404 when no offer answers the read', async () => {
      serveRow(null);

      await expect(service.findOneById(candidate, 50)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reads only open offers for a candidate', async () => {
      serveRow(offerRow());

      await service.findOneById(candidate, 50);

      expect(whereOf()).toEqual({ id: 50, OR: [{ status: 'open' }] });
    });

    // A recruiter reads the drafts of their own company, and nothing else that
    // is not open.
    it('widens the read of a recruiter to every offer of their company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      serveRow(offerRow({ status: 'draft' }));

      await service.findOneById(recruiter, 50);

      expect(whereOf()).toEqual({
        id: 50,
        OR: [{ status: 'open' }, { companyId: 10 }],
      });
    });
  });
});
