import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TagCategory } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferFeedItemDto } from './dto/offer-feed-item.dto';
import { OfferFeedQueryDto } from './dto/offer-feed-query.dto';
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
} as const;

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

    return this.prisma.offer.findMany({
      where: {
        companyId: profile.companyId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: LIST_ITEM_COLUMNS,
    });
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
      select: {
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
        // Filtered on the category rather than trusting the pivot to hold one
        // kind: `offer_tag` carries the benefits too, and `tags` advertises
        // the skills of the post, not its perks.
        offerTags: {
          where: { tag: { category: 'skill' } },
          orderBy: { tag: { label: 'asc' } },
          select: { tag: { select: { label: true } } },
        },
      },
    });

    return offers.map(({ offerTags, ...offer }) => ({
      ...offer,
      tags: offerTags.map((link) => link.tag.label),
    }));
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
