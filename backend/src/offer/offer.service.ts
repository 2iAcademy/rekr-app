import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TagCategory } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferFeedItemDto } from './dto/offer-feed-item.dto';
import { OfferFeedQueryDto } from './dto/offer-feed-query.dto';
import { OfferApplicantDto } from './dto/offer-applicant.dto';
import { OfferApplicantsQueryDto } from './dto/offer-applicants-query.dto';
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

@Injectable()
export class OfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CityService,
  ) {}

  async create(userId: number, dto: CreateOfferDto) {
    const { skills, benefits, ...offerData } = dto;

    const coordinates = await this.cities.assertKnown(dto);

    return this.prisma.$transaction(async (tx) => {
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
  }

  async update(userId: number, offerId: number, dto: UpdateOfferDto) {
    const { skills, benefits, ...offerData } = dto;
    let coordinates: Coordinates | null = null;

    if (dto.city !== undefined || dto.postalCode !== undefined) {
      coordinates = await this.verifyPatchedLocation(userId, offerId, dto);
    }

    return this.prisma.$transaction(async (tx) => {
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

  async findFeed(
    user: AuthUser,
    query: OfferFeedQueryDto,
  ): Promise<OfferFeedItemDto[]> {
    const { limit, contractType, experienceLevel, remotePolicy, city } = query;

    const offers = await this.prisma.offer.findMany({
      where: {
        status: 'open',
        ...(contractType ? { contractType } : {}),
        ...(experienceLevel ? { minExperienceLevel: experienceLevel } : {}),
        ...(remotePolicy ? { remotePolicy } : {}),
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
        candidateLikes: { none: { candidateUserId: user.id } },
        candidatePasses: { none: { candidateUserId: user.id } },
      },
      // `createdAt` alone is not unique, so it cannot order the deck on its
      // own: two offers written in the same instant would swap places from one
      // read to the next. The id break is what makes the order stable.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: SHOWCASE_OFFER_COLUMNS,
    });

    return offers.map(toShowcaseOffer);
  }

  /**
   * Writes down that a candidate is interested in an offer.
   *
   * Idempotent: liking twice is what a double tap produces, not an error worth
   * showing. No `Match` is derived from a reciprocal pair — that rule belongs
   * to #134, and settling it here would decide a product question this code
   * does not carry.
   */
  async like(candidateUserId: number, offerId: number): Promise<void> {
    // Only a published offer can be liked, and a candidate cannot see any
    // other — same 404 as the detail route, for the same reason: a 403 on an
    // unpublished offer would confirm that the id exists.
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, status: 'open' },
      select: { id: true },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    await this.prisma.candidateLikesOffer.createMany({
      data: [{ candidateUserId, offerId }],
      skipDuplicates: true,
    });
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
   * anything is written. Idempotent, and no `Match` is derived — see `like`.
   *
   * The row itself carries no offer: `RecruiterLikesCandidate` is keyed on the
   * pair alone, and giving it an `offerId` is #134's business, not this one's.
   */
  async likeApplicant(
    recruiterUserId: number,
    offerId: number,
    candidateUserId: number,
  ): Promise<void> {
    await this.assertOwnedOffer(recruiterUserId, offerId);

    // One answer for « no such application » and « not on this offer »: a
    // recruiter may only answer someone who came to them.
    const application = await this.prisma.candidateLikesOffer.findUnique({
      where: {
        candidateUserId_offerId: { candidateUserId, offerId },
      },
      select: { candidateUserId: true },
    });
    if (!application) {
      throw new NotFoundException('Applicant not found');
    }

    await this.prisma.recruiterLikesCandidate.createMany({
      data: [{ recruiterUserId, candidateUserId }],
      skipDuplicates: true,
    });
  }

  /**
   * Resolves the offer a recruiter names, or answers 404.
   *
   * 404 rather than 403 on an offer of another company, as everywhere else
   * here: telling a stranger « not yours » already tells them the id exists.
   */
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

  async findOneById(user: AuthUser, id: number) {
    const profile =
      user.userType === 'recruiter'
        ? await this.prisma.recruiterProfile.findUnique({
            where: { userId: user.id },
          })
        : null;

    const offer = await this.prisma.offer.findFirst({
      where: {
        id,
        OR: [
          { status: 'open' },
          ...(profile ? [{ companyId: profile.companyId }] : []),
        ],
      },
      include: {
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
        offerTags: {
          include: {
            tag: {
              select: {
                id: true,
                label: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
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
