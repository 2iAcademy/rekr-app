import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, TagCategory } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import type { AuthUser } from '../auth/auth-user.interface';
import { JobFamilyService } from '../job-family/job-family.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatchService } from '../match/match.service';
import { OfferSearchService } from '../search/offer-search.service';
import {
  CONTRACT_TYPE_COUNT,
  REMOTE_POLICY_COUNT,
  allowedContractTypes,
  allowedRemotePolicies,
} from '../search/ranking/offer-ranking';
import { LikeResultDto } from '../match/dto/like-result.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferFeedItemDto } from './dto/offer-feed-item.dto';
import { OfferFeedQueryDto } from './dto/offer-feed-query.dto';
import { OfferApplicantDto } from './dto/offer-applicant.dto';
import { OfferApplicantsQueryDto } from './dto/offer-applicants-query.dto';
import { OfferDetailDto } from './dto/offer-detail.dto';
import { OfferListItemDto } from './dto/offer-list-item.dto';
import { OfferListQueryDto } from './dto/offer-list-query.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

const LIST_ITEM_COLUMNS = {
  id: true,
  title: true,
  status: true,
  city: true,
  postalCode: true,
  contractType: true,
  minExperienceLevel: true,
  remotePolicy: true,
  salaryMin: true,
  salaryMax: true,
  createdAt: true,
  updatedAt: true,
  // What makes the list actionable: without it the recruiter has to open every
  // offer to find the one people applied to.
  //
  // Counted over the same population `findApplicants` lists, not over the raw
  // pivot: a badge saying « 2 intéressés » above a screen showing one is a bug
  // report waiting to happen — and the gap would tell the recruiter that an
  // account was deactivated.
  _count: {
    select: {
      candidateLikes: {
        where: { user: { isActive: true, candidateProfile: { isNot: null } } },
      },
    },
  },
} as const;

/**
 * The showcase projection of an offer, shared by the candidate feed and the
 * list of offers a candidate liked: two reads of the same thing by the same
 * role, so they answer the same shape.
 */
const SHOWCASE_OFFER_COLUMNS = {
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
    },
  },
  // Filtered on the category rather than trusting the pivot to hold one kind:
  // `offer_tag` carries the benefits too, and `tags` advertises the skills of
  // the post, not its perks.
  offerTags: {
    where: { tag: { category: 'skill' } },
    orderBy: { tag: { label: 'asc' } },
    select: { tag: { select: { label: true } } },
  },
} as const;

/**
 * The showcase projection of a single offer: the same columns the feed serves,
 * plus the ones the detail screen has room for. Declared as a `select` and not
 * an `include` so that a column added to `offer` tomorrow stays off the wire
 * until someone puts it here.
 */
const DETAIL_OFFER_COLUMNS = {
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
  // Every category, unlike the feed: the detail screen tells the skills from
  // the perks itself, and needs both.
  offerTags: {
    orderBy: { tag: { label: 'asc' } },
    select: { tag: { select: { label: true, category: true } } },
  },
} as const;

/**
 * What the company carrying the offer reads on top: the postcode places the
 * office and the status says where the offer stands in its life cycle, both
 * read by the management screen and by no one else. The coordinates are read
 * by no screen at all, so they are in neither projection.
 */
const OWNER_DETAIL_OFFER_COLUMNS = {
  ...DETAIL_OFFER_COLUMNS,
  postalCode: true,
  status: true,
  // Read by the edit form to preselect the trade. Absent from the candidate
  // projection: the family decides which feed the offer reaches, it is not
  // something the card has to show.
  jobFamilyId: true,
} as const;

/** The columns of an applicant a recruiter may read, and no others. */
const APPLICANT_COLUMNS = {
  userId: true,
  firstName: true,
  picture: true,
  bio: true,
  city: true,
  desiredJobTitle: true,
  contractTypes: true,
  experienceLevel: true,
  availability: true,
  remotePolicy: true,
} as const;

type ShowcaseOfferRow = {
  offerTags: { tag: { label: string } }[];
};

/** Flattens the tag pivot into the list of labels the clients read. */
const toShowcaseOffer = <T extends ShowcaseOfferRow>({
  offerTags,
  ...offer
}: T): Omit<T, 'offerTags'> & { tags: string[] } => ({
  ...offer,
  tags: offerTags.map((link) => link.tag.label),
});

type DetailTag = { label: string; category: TagCategory };

type DetailOfferRow = { offerTags: { tag: DetailTag }[] };

/**
 * Flattens the tag pivot the detail screen reads. Unlike the showcase one it
 * keeps the category: the recruiter form splits the labels on it, and the
 * candidate screen tells a skill from a perk the same way.
 */
const toDetailOffer = <T extends DetailOfferRow>({
  offerTags,
  ...offer
}: T): Omit<T, 'offerTags'> & { tags: DetailTag[] } => ({
  ...offer,
  tags: offerTags.map((link) => link.tag),
});

@Injectable()
export class OfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CityService,
    private readonly matches: MatchService,
    private readonly jobFamilies: JobFamilyService,
    @Optional() private readonly search?: OfferSearchService,
  ) {}

  async create(userId: number, dto: CreateOfferDto) {
    const { skills, benefits, ...offerData } = dto;

    await this.jobFamilies.assertKnown([dto.jobFamilyId]);
    const coordinates = await this.cities.assertKnown(dto);

    const offer = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.recruiterProfile.findUnique({
        where: { userId },
      });
      if (!profile) {
        throw new NotFoundException('Recruiter has no company');
      }

      const offer = await tx.offer.create({
        data: {
          ...offerData,
          ...(coordinates ?? {}),
          companyId: profile.companyId,
          createdById: userId,
        },
      });

      await this.syncTagLists(tx, offer.id, { skills, benefits });

      return offer;
    });
    await this.search?.syncOffer(offer.id);
    return offer;
  }

  async update(userId: number, offerId: number, dto: UpdateOfferDto) {
    const { skills, benefits, ...offerData } = dto;
    let coordinates: Coordinates | null = null;

    if (dto.jobFamilyId !== undefined) {
      await this.jobFamilies.assertKnown([dto.jobFamilyId]);
    }

    if (dto.city !== undefined || dto.postalCode !== undefined) {
      coordinates = await this.verifyPatchedLocation(userId, offerId, dto);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      const profile = await tx.recruiterProfile.findUnique({
        where: { userId },
      });

      // One answer for « no such offer » and « not yours »: a 403 on someone
      // else's offer confirms the id exists, which is the whole of what an
      // enumeration needs.
      if (!offer || !profile || offer.companyId !== profile.companyId) {
        throw new NotFoundException('Offer not found');
      }

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { ...offerData, ...(coordinates ?? {}) },
      });

      await this.syncTagLists(tx, offerId, { skills, benefits });

      return updated;
    });
    await this.search?.syncOffer(updated.id);
    return updated;
  }

  /**
   * The recruiter's own offers, every status included — this is the screen
   * where a draft gets published and a closed offer reopened, not the candidate
   * feed. Scoping on the company rather than on `createdById` is what lets a
   * second recruiter of the same company take over an offer they did not write.
   */
  async findMine(
    userId: number,
    { page = 1, limit = 50, status }: OfferListQueryDto,
  ): Promise<OfferListItemDto[]> {
    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { companyId: true },
    });
    if (!profile) {
      throw new NotFoundException('Recruiter has no company');
    }

    const offers = await this.prisma.offer.findMany({
      where: {
        companyId: profile.companyId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: LIST_ITEM_COLUMNS,
    });

    // Flattened: `_count` is a Prisma shape, and leaking it into the contract
    // would tie the client to the way the figure happens to be read.
    return offers.map(({ _count, ...offer }) => ({
      ...offer,
      applicantCount: _count.candidateLikes,
    }));
  }

  /**
   * The deck a candidate swipes, shaped by their own profile.
   *
   * The preferences are read here from the stored profile rather than taken
   * from the query: they are already recorded, so asking the client to resend
   * them would give one fact two sources, and let the deck drift from the
   * profile the candidate is shown. The screen has no filter bar for the same
   * reason — those two axes are edited on the profile, and nowhere else.
   *
   * This is curation, NOT an access boundary, and nothing here should be read
   * as one: `GET /offers/:id` and `POST /offers/:id/like` both serve any `open`
   * offer to any candidate, preferences or not. A narrower deck hides nothing
   * that iterating over the ids would not reveal.
   *
   * An unset preference narrows nothing: the candidate did not say, which is
   * not the same as wanting nothing. Symmetrically, an offer that left the
   * field empty is kept — a post that never said is not a post that says no.
   */
  async findFeed(
    user: AuthUser,
    query: OfferFeedQueryDto,
  ): Promise<OfferFeedItemDto[]> {
    const { limit } = query;

    const [profile, wantedFamilies] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { userId: user.id },
        select: {
          contractTypes: true,
          experienceLevel: true,
          remotePolicy: true,
          salaryMin: true,
          salaryMax: true,
          latitude: true,
          longitude: true,
          mobilityRadiusKm: true,
          mobilityNationwide: true,
          user: {
            select: {
              candidateTags: {
                where: { tag: { category: { in: ['skill', 'tech'] } } },
                select: { tag: { select: { label: true } } },
              },
            },
          },
        },
      }),
      this.prisma.candidateJobFamily.findMany({
        where: { candidateUserId: user.id },
        select: { jobFamilyId: true },
      }),
    ]);

    const wantedContracts = profile?.contractTypes ?? [];
    const wantedRemote = profile?.remotePolicy ?? null;
    const wantedFamilyIds = wantedFamilies.map((link) => link.jobFamilyId);
    // The contract is no longer a filter: a permanent-contract filter amputates
    // half the stock of a temping agency and hides the best offer of the
    // catalogue for an administrative reason. It is ranked instead, by
    // `CONTRACT_AFFINITY`.
    //
    // One exception survives as a filter, and the matrix is what names it:
    // apprenticeships and internships are a status, not a preference, so
    // neither side of that line is served the other. Applied here rather than
    // in the Elasticsearch query alone because the ranked page is topped up
    // straight from PostgreSQL — an unindexed internship would otherwise walk
    // into the deck of someone looking for a permanent contract.
    const allowedContracts = allowedContractTypes(wantedContracts);
    const allowedRemote = allowedRemotePolicies(wantedRemote);
    const preferences: Prisma.OfferWhereInput[] = [
      ...(allowedContracts.length < CONTRACT_TYPE_COUNT
        ? [
            {
              OR: [
                { contractType: { in: allowedContracts } },
                { contractType: { equals: null } },
              ],
            },
          ]
        : []),
      // Remote work still filters, but on what the candidate can hold rather
      // than on a literal match: someone who asked for hybrid was offering to
      // come in, not requiring it, so a fully remote post suits them too. The
      // inability only points one way, which is why `REMOTE_AFFINITY` is not
      // symmetric where `CONTRACT_AFFINITY` is.
      ...(allowedRemote.length < REMOTE_POLICY_COUNT
        ? [
            {
              OR: [
                { remotePolicy: { in: allowedRemote } },
                { remotePolicy: { equals: null } },
              ],
            },
          ]
        : []),
    ];
    const eligibleWhere: Prisma.OfferWhereInput = {
      status: 'open',
      ...(preferences.length > 0 ? { AND: preferences } : {}),
      // The trade excludes rather than scores: nobody changes career because an
      // unrelated post pays well, so a family that does not match has no rank
      // low enough to be worth showing. Applied here rather than on the query
      // below so the Elasticsearch path and its PostgreSQL top-up share it.
      //
      // A candidate who named no family is left unfiltered, which keeps the
      // accounts created before this column from facing an empty deck. Once
      // they name one, an offer carrying no family stops matching: its trade is
      // unknown, and an unknown trade is not a wildcard.
      ...(wantedFamilyIds.length > 0
        ? { jobFamilyId: { in: wantedFamilyIds } }
        : {}),
      candidateLikes: { none: { candidateUserId: user.id } },
      candidatePasses: { none: { candidateUserId: user.id } },
    };
    const fallbackOrder: Prisma.OfferOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];

    // Elasticsearch ranks only ids. This PostgreSQL query is the final gate for
    // status and prior decisions, so a delayed index can never serve an offer a
    // candidate has already answered or one that is no longer published.
    const rankedIds = await this.search?.rankOfferIds(
      {
        jobFamilyIds: wantedFamilyIds,
        skills: profile?.user.candidateTags.map((link) => link.tag.label) ?? [],
        contractTypes: wantedContracts,
        experienceLevel: profile?.experienceLevel ?? null,
        remotePolicy: wantedRemote,
        salaryMin: profile?.salaryMin ?? null,
        salaryMax: profile?.salaryMax ?? null,
        latitude:
          profile?.latitude === null || profile?.latitude === undefined
            ? null
            : Number(profile.latitude),
        longitude:
          profile?.longitude === null || profile?.longitude === undefined
            ? null
            : Number(profile.longitude),
        mobilityRadiusKm: profile?.mobilityRadiusKm ?? null,
        mobilityNationwide: profile?.mobilityNationwide ?? null,
      },
      limit,
    );

    if (rankedIds === null || rankedIds === undefined) {
      const offers = await this.prisma.offer.findMany({
        where: eligibleWhere,
        orderBy: fallbackOrder,
        take: limit,
        select: SHOWCASE_OFFER_COLUMNS,
      });
      return offers.map(toShowcaseOffer);
    }

    const rankedRows = await this.prisma.offer.findMany({
      where: { ...eligibleWhere, id: { in: rankedIds } },
      select: SHOWCASE_OFFER_COLUMNS,
    });
    const rowsById = new Map(rankedRows.map((offer) => [offer.id, offer]));
    const rankedOffers = rankedIds.flatMap((id) => {
      const offer = rowsById.get(id);
      return offer ? [offer] : [];
    });

    // Indexing is asynchronous. Fill a short ranked page from PostgreSQL so a
    // just-published or newly repaired offer is not hidden while its document
    // catches up.
    const remaining = limit - rankedOffers.length;
    if (remaining > 0) {
      const fallback = await this.prisma.offer.findMany({
        where: { ...eligibleWhere, id: { notIn: rankedIds } },
        orderBy: fallbackOrder,
        take: remaining,
        select: SHOWCASE_OFFER_COLUMNS,
      });
      rankedOffers.push(...fallback);
    }

    return rankedOffers.slice(0, limit).map(toShowcaseOffer);
  }
  /**
   * Writes down that a candidate is interested in an offer.
   *
   * Idempotent: liking twice is what a double tap produces, not an error worth
   * showing. The reciprocal recruiter decision is checked in the same
   * transaction, which is what makes creating a Match race-safe.
   */
  async like(candidateUserId: number, offerId: number): Promise<LikeResultDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAnswer(tx, candidateUserId, offerId);
      const offer = await tx.offer.findFirst({
        where: { id: offerId, status: 'open' },
        select: { id: true, companyId: true },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      // The two answers are exclusive, so the one being given clears the
      // other: a candidate may change their mind, but the pair must never
      // carry a like and a pass at once.
      await tx.candidatePassesOffer.deleteMany({
        where: { candidateUserId, offerId },
      });
      const like = await tx.candidateLikesOffer.createMany({
        data: [{ candidateUserId, offerId }],
        skipDuplicates: true,
      });
      const reciprocal = await tx.recruiterLikesCandidate.findFirst({
        where: {
          candidateUserId,
          offerId,
          recruiter: { recruiterProfile: { companyId: offer.companyId } },
        },
        orderBy: [{ likedAt: 'asc' }, { recruiterUserId: 'asc' }],
        select: { recruiterUserId: true },
      });
      if (!reciprocal)
        return { likeCreated: like.count === 1, matchCreated: false };
      const result = await this.matches.tryCreateReciprocalMatch(
        tx,
        candidateUserId,
        offerId,
        reciprocal.recruiterUserId,
        'candidate',
      );
      return { likeCreated: like.count === 1, ...result };
    });
  }
  /** Records a candidate's decision not to pursue an open offer. */
  async pass(candidateUserId: number, offerId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAnswer(tx, candidateUserId, offerId);
      const offer = await tx.offer.findFirst({
        where: { id: offerId, status: 'open' },
        select: { id: true },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      await this.assertNotMatched(tx, candidateUserId, offerId);
      await tx.candidateLikesOffer.deleteMany({
        where: { candidateUserId, offerId },
      });
      await tx.candidatePassesOffer.createMany({
        data: [{ candidateUserId, offerId }],
        skipDuplicates: true,
      });
    });
  }

  /**
   * Takes back a candidate's like on an offer.
   *
   * Idempotent, and deliberately blind to the offer itself: a pair carrying no
   * like answers like one that did, and an offer that has left `open` since
   * the like was written must still be releasable — the candidate is undoing
   * their own row, not reading the post.
   */
  async unlike(candidateUserId: number, offerId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAnswer(tx, candidateUserId, offerId);
      await this.assertNotMatched(tx, candidateUserId, offerId);
      await tx.candidateLikesOffer.deleteMany({
        where: { candidateUserId, offerId },
      });
    });
  }

  /**
   * Serialises everything that decides what a candidate and a recruiter
   * answered about one offer.
   *
   * The answers live in four tables — the two likes, the pass, the match — and
   * each holds only its own primary key, so no constraint can say that they
   * exclude one another or that a match rests on a like. Under READ COMMITTED
   * the checks that stand in for those constraints all read a state the
   * concurrent transaction has not committed yet, and both sides then write:
   * a like and a pass standing together, and a match left on a like that was
   * being withdrawn — which is worse than it looks, because the candidate is
   * then engaged on an application they no longer have and `unlike` answers
   * 409 from that point on.
   *
   * A transaction-scoped advisory lock is preferred over `Serializable`, which
   * would need a P2034 replay loop around four handlers and would still let a
   * retried write land after the client gave up, and over folding the two
   * answers into one table, which is a migration and a model rewrite to buy an
   * invariant these two lines already hold. Cost: one round trip per write,
   * and contention bounded by the pair — only one candidate double-tapping one
   * offer ever waits, never two candidates, never two offers.
   *
   * Taken before any read, since a lock acquired after the check it is meant
   * to protect guards nothing. Run through `$executeRaw` rather than
   * `$queryRaw`, which cannot decode the `void` the function returns.
   */
  private lockAnswer(
    tx: Prisma.TransactionClient,
    candidateUserId: number,
    offerId: number,
  ): Promise<number> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${candidateUserId}::int, ${offerId}::int)`;
  }

  /**
   * A match is a mutual commitment, and neither half of it is undone from the
   * offer screen: refusing here is what keeps the likes list and the matches
   * list from telling opposite stories about the same pair. Accepting the
   * write and leaving the match standing would do exactly that.
   */
  private async assertNotMatched(
    tx: Prisma.TransactionClient,
    candidateUserId: number,
    offerId: number,
  ): Promise<void> {
    const match = await tx.match.findUnique({
      where: { candidateUserId_offerId: { candidateUserId, offerId } },
      select: { id: true },
    });

    if (match) {
      throw new ConflictException(
        'Cette offre a déjà donné lieu à un match : il ne peut pas être défait ici.',
      );
    }
  }
  /** The offers the calling candidate has liked, newest interest first. */
  async findLiked(
    candidateUserId: number,
    { page, limit }: OfferApplicantsQueryDto,
  ): Promise<OfferFeedItemDto[]> {
    const likes = await this.prisma.candidateLikesOffer.findMany({
      // Published only, exactly as the match list reads: a like is not a
      // standing right to read the offer. Unpublished, the post is being
      // reworked, and `GET /offers/:id` answers 404 on it — this list must not
      // be the way around that.
      where: { candidateUserId, offer: { status: 'open' } },
      // `offerId` breaks the ties `likedAt` leaves: two likes written in the
      // same instant would otherwise swap places between two reads.
      orderBy: [{ likedAt: 'desc' }, { offerId: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: { offer: { select: SHOWCASE_OFFER_COLUMNS } },
    });

    return likes.map(({ offer }) => toShowcaseOffer(offer));
  }

  /**
   * The candidates who liked one of the recruiter's offers.
   *
   * Every status is served, not just `open`: the recruiter drives the whole
   * life cycle from their own screens, and a paused post still has applicants
   * to answer.
   */
  async findApplicants(
    recruiterUserId: number,
    offerId: number,
    { page, limit }: OfferApplicantsQueryDto,
  ): Promise<OfferApplicantDto[]> {
    await this.assertOwnedOffer(recruiterUserId, offerId);

    const likes = await this.prisma.candidateLikesOffer.findMany({
      // Both predicates belong in the `where`, not after the read: filtering a
      // page once it is fetched returns fewer rows than asked without it being
      // the last one, and the caller cannot tell the two apart.
      //
      // A like cannot exist without an account, but a profile can still be
      // missing: signup writes the user, the wizard writes the profile. Such a
      // row has nothing to show.
      where: {
        offerId,
        user: { isActive: true, candidateProfile: { isNot: null } },
      },
      orderBy: [{ likedAt: 'desc' }, { candidateUserId: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        user: {
          select: {
            candidateProfile: { select: APPLICANT_COLUMNS },
            // Same detour as the profile reads: `candidate_tag` is keyed on
            // the user, and selecting nothing else off that relation keeps the
            // account columns out of reach.
            candidateTags: {
              where: { tag: { category: 'skill' } },
              orderBy: { tag: { label: 'asc' } },
              select: { tag: { select: { label: true } } },
            },
            likesReceived: {
              where: { recruiterUserId, offerId },
              select: { likedAt: true },
              take: 1,
            },
            passesReceived: {
              where: { recruiterUserId, offerId },
              select: { passedAt: true },
              take: 1,
            },
          },
        },
      },
    });

    // The `where` above guarantees the profile, which the types cannot know.
    return likes.flatMap(({ user }) =>
      user.candidateProfile
        ? [
            {
              ...user.candidateProfile,
              tags: user.candidateTags.map((link) => link.tag.label),
              recruiterLikedAt: user.likesReceived[0]?.likedAt ?? null,
              recruiterPassedAt: user.passesReceived[0]?.passedAt ?? null,
            },
          ]
        : [],
    );
  }

  /**
   * Writes down the recruiter's interest in one of their applicants.
   *
   * Scoped through the offer: the recruiter answers someone who applied to a
   * post of theirs, so both the offer and the application are verified before
   * anything is written. The recruiter decision is scoped to that offer and
   * can create the reciprocal Match in the same transaction.
   */
  async likeApplicant(
    recruiterUserId: number,
    offerId: number,
    candidateUserId: number,
  ): Promise<LikeResultDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAnswer(tx, candidateUserId, offerId);
      const [offer, profile] = await Promise.all([
        tx.offer.findFirst({
          where: { id: offerId, status: 'open' },
          select: { companyId: true },
        }),
        tx.recruiterProfile.findUnique({
          where: { userId: recruiterUserId },
          select: { companyId: true },
        }),
      ]);
      if (!offer || !profile || offer.companyId !== profile.companyId)
        throw new NotFoundException('Offer not found');
      const application = await tx.candidateLikesOffer.findUnique({
        where: { candidateUserId_offerId: { candidateUserId, offerId } },
        select: { candidateUserId: true },
      });
      if (!application) throw new NotFoundException('Applicant not found');
      const like = await tx.recruiterLikesCandidate.createMany({
        data: [{ recruiterUserId, candidateUserId, offerId }],
        skipDuplicates: true,
      });
      const result = await this.matches.tryCreateReciprocalMatch(
        tx,
        candidateUserId,
        offerId,
        recruiterUserId,
        'recruiter',
      );
      return { likeCreated: like.count === 1, ...result };
    });
  }
  /** Records a recruiter's decision not to pursue an applicant. */
  async passApplicant(
    recruiterUserId: number,
    offerId: number,
    candidateUserId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [offer, profile] = await Promise.all([
        tx.offer.findUnique({
          where: { id: offerId },
          select: { companyId: true },
        }),
        tx.recruiterProfile.findUnique({
          where: { userId: recruiterUserId },
          select: { companyId: true },
        }),
      ]);
      if (!offer || !profile || offer.companyId !== profile.companyId)
        throw new NotFoundException('Offer not found');
      const application = await tx.candidateLikesOffer.findUnique({
        where: { candidateUserId_offerId: { candidateUserId, offerId } },
        select: { candidateUserId: true },
      });
      if (!application) throw new NotFoundException('Applicant not found');
      await tx.recruiterPassesCandidate.createMany({
        data: [{ recruiterUserId, candidateUserId, offerId }],
        skipDuplicates: true,
      });
    });
  }
  private async assertOwnedOffer(
    recruiterUserId: number,
    offerId: number,
  ): Promise<void> {
    const [offer, profile] = await Promise.all([
      this.prisma.offer.findUnique({
        where: { id: offerId },
        select: { companyId: true },
      }),
      this.prisma.recruiterProfile.findUnique({
        where: { userId: recruiterUserId },
        select: { companyId: true },
      }),
    ]);

    if (!offer || !profile || offer.companyId !== profile.companyId) {
      throw new NotFoundException('Offer not found');
    }
  }

  async findOneById(user: AuthUser, id: number): Promise<OfferDetailDto> {
    const profile =
      user.userType === 'recruiter'
        ? await this.prisma.recruiterProfile.findUnique({
            where: { userId: user.id },
          })
        : null;

    // An offer is readable while it is published; a recruiter reads every offer
    // of their own company, whatever its status.
    const where = {
      id,
      OR: [
        { status: 'open' as const },
        ...(profile ? [{ companyId: profile.companyId }] : []),
      ],
    };

    // Which projection applies depends on the company carrying the offer, so
    // ownership is settled on a read of its own. Claiming the owner columns
    // first and dropping them afterwards would have taken them out of the
    // database, and the next spread would put them back on the wire.
    const owned =
      profile !== null &&
      (
        await this.prisma.offer.findFirst({
          where,
          select: { companyId: true },
        })
      )?.companyId === profile.companyId;

    const offer = owned
      ? await this.prisma.offer.findFirst({
          where,
          select: OWNER_DETAIL_OFFER_COLUMNS,
        })
      : await this.prisma.offer.findFirst({
          where,
          select: DETAIL_OFFER_COLUMNS,
        });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Read for the candidate only, and absent — not false — for anyone else:
    // a recruiter has no answer to give on an offer, and the same convention
    // already governs `postalCode` and `status`.
    const answer =
      user.userType === 'candidate'
        ? await this.readCandidateAnswer(user.id, id)
        : {};

    return { ...toDetailOffer(offer), ...answer };
  }

  /**
   * What the calling candidate has already answered on an offer.
   *
   * The deck never shows an offer that carries one — `findFeed` excludes both
   * — but the likes list links straight to the detail screen, so the screen
   * has to know before it offers « Passer / Liker » again.
   *
   * A match does not clear the like, so it is read alongside: the two states
   * are otherwise indistinguishable on the wire.
   */
  private async readCandidateAnswer(
    candidateUserId: number,
    offerId: number,
  ): Promise<{ liked: boolean; passed: boolean; matched: boolean }> {
    const key = { candidateUserId_offerId: { candidateUserId, offerId } };
    const [liked, passed, matched] = await Promise.all([
      this.prisma.candidateLikesOffer.findUnique({
        where: key,
        select: { offerId: true },
      }),
      this.prisma.candidatePassesOffer.findUnique({
        where: key,
        select: { offerId: true },
      }),
      this.prisma.match.findUnique({
        where: key,
        select: { offerId: true },
      }),
    ]);

    return {
      liked: liked !== null,
      passed: passed !== null,
      matched: matched !== null,
    };
  }

  /**
   * Verified outside the transaction, because the check goes over the network
   * and an open transaction must not wait on a third party.
   *
   * Silent when the caller does not own the offer: the transaction below is
   * what answers 404, and a 400 on the location raised here would hide it —
   * telling a stranger that the location they sent is wrong is already telling
   * them the offer exists.
   */
  private async verifyPatchedLocation(
    userId: number,
    offerId: number,
    dto: UpdateOfferDto,
  ): Promise<Coordinates | null> {
    const [offer, profile] = await Promise.all([
      this.prisma.offer.findUnique({
        where: { id: offerId },
        select: { city: true, postalCode: true, companyId: true },
      }),
      this.prisma.recruiterProfile.findUnique({
        where: { userId },
        select: { companyId: true },
      }),
    ]);

    if (!offer || !profile || offer.companyId !== profile.companyId) {
      return null;
    }

    return this.cities.assertKnown({
      city: dto.city ?? offer.city,
      postalCode: dto.postalCode ?? offer.postalCode,
    });
  }

  /**
   * An omitted list means « leave it as it is », an empty one means « clear it ».
   * Distinguishing the two is what lets a patch touch the skills without
   * mentioning the benefits, and the other way round.
   */
  private async syncTagLists(
    tx: Prisma.TransactionClient,
    offerId: number,
    lists: { skills?: string[]; benefits?: string[] },
  ): Promise<void> {
    if (lists.skills) {
      await this.syncOfferTags(tx, offerId, lists.skills, 'skill');
    }

    if (lists.benefits) {
      await this.syncOfferTags(tx, offerId, lists.benefits, 'benefit');
    }
  }

  /**
   * Replaces one category of an offer's tags, and only that one.
   *
   * The wipe is scoped on the category as well as on the offer: skills and
   * benefits share the `offer_tag` pivot, so a wipe on `offerId` alone would
   * make saving either list silently delete the other.
   */
  private async syncOfferTags(
    tx: Prisma.TransactionClient,
    offerId: number,
    labels: string[],
    category: TagCategory,
  ): Promise<void> {
    await tx.offerTag.deleteMany({ where: { offerId, tag: { category } } });

    const tagIds = await resolveTagIds(tx, labels, category);
    if (tagIds.length === 0) {
      return;
    }

    await tx.offerTag.createMany({
      data: tagIds.map((tagId) => ({ offerId, tagId })),
      skipDuplicates: true,
    });
  }
}
