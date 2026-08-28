import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
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
    const { skills, ...offerData } = dto;

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

      if (skills) {
        await this.syncSkills(tx, offer.id, skills);
      }

      return offer;
    });
  }

  async update(userId: number, offerId: number, dto: UpdateOfferDto) {
    const { skills, ...offerData } = dto;
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

      if (skills) {
        await this.syncSkills(tx, offerId, skills);
      }

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

  private async syncSkills(
    tx: Prisma.TransactionClient,
    offerId: number,
    skills: string[],
  ): Promise<void> {
    // `offerTag` rows are only ever written here, and skills are the only
    // category an offer links, so wiping the set and re-creating it from the
    // payload is the symmetric operation.
    await tx.offerTag.deleteMany({ where: { offerId } });

    const tagIds = await resolveTagIds(tx, skills, 'skill');
    if (tagIds.length === 0) {
      return;
    }

    await tx.offerTag.createMany({
      data: tagIds.map((tagId) => ({ offerId, tagId })),
      skipDuplicates: true,
    });
  }
}
