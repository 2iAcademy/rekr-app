import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { resolveTagIds } from '../common/tags/tag-sync';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

@Injectable()
export class OfferService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateOfferDto) {
    const { skills, ...offerData } = dto;

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

    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) {
        throw new NotFoundException('Offer not found');
      }

      const profile = await tx.recruiterProfile.findUnique({
        where: { userId },
      });
      if (!profile || offer.companyId !== profile.companyId) {
        throw new ForbiddenException();
      }

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { ...offerData },
      });

      if (skills) {
        await this.syncSkills(tx, offerId, skills);
      }

      return updated;
    });
  }

  async findAllOpen() {
    return this.prisma.offer.findMany({
      where: { status: 'open' },
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
          include: { tag: { select: { id: true, label: true, category: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneById(id: number) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
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
          include: { tag: { select: { id: true, label: true, category: true } } },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }

  private async syncSkills(
    tx: Prisma.TransactionClient,
    offerId: number,
    skills: string[],
  ): Promise<void> {
    // See `CandidateProfileService.syncSkills`: filtering the unlink by
    // category makes a link indelible as soon as the label pre-exists under
    // another category. `offerTag` rows are only written here.
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
