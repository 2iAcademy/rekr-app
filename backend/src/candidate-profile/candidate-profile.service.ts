import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@Injectable()
export class CandidateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CityService,
  ) {}

  async create(userId: number, dto: CreateCandidateProfileDto) {
    const { skills, languages, ...profileData } = dto;

    // Conflict first: a caller who already has a profile deserves the 409, not
    // a complaint about the commune they sent. The transaction below repeats
    // the check, which is what makes it race-proof; this one only decides
    // whether it is worth calling a third party at all.
    const taken = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (taken) {
      throw new ConflictException('Candidate profile already exists');
    }

    const coordinates = await this.cities.assertKnown(dto);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidateProfile.findUnique({
        where: { userId },
      });
      if (existing) {
        throw new ConflictException('Candidate profile already exists');
      }

      const profile = await tx.candidateProfile.create({
        data: { ...profileData, ...(coordinates ?? {}), userId },
      });

      if (skills || languages) {
        await this.syncTags(tx, userId, skills, languages);
      }

      return profile;
    });
  }

  async update(userId: number, dto: UpdateCandidateProfileDto) {
    const { skills, languages, ...profileData } = dto;
    let coordinates: Coordinates | null = null;

    if (dto.city !== undefined || dto.postalCode !== undefined) {
      // Read outside the transaction on purpose: verifying the pair goes over
      // the network, and an open transaction must not wait on a third party.
      const stored = await this.prisma.candidateProfile.findUnique({
        where: { userId },
        select: { city: true, postalCode: true },
      });

      coordinates = await this.cities.assertKnown({
        city: dto.city ?? stored?.city,
        postalCode: dto.postalCode ?? stored?.postalCode,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidateProfile.findUnique({
        where: { userId },
      });
      if (!existing) {
        throw new NotFoundException('Candidate profile not found');
      }

      const profile = await tx.candidateProfile.update({
        where: { userId },
        data: { ...profileData, ...(coordinates ?? {}) },
      });

      if (skills || languages) {
        await this.syncTags(tx, userId, skills, languages);
      }

      return profile;
    });
  }

  /**
   * Skills and languages are written as one set, not one category at a time: a
   * payload carrying only one of the two clears the other. Both lists come from
   * the same screen and are always submitted together, so the wizard never sees
   * that rule; a partial patch that means to keep the other list has to send it
   * back. `candidateTag` rows are only ever written here, so deleting them all
   * and re-creating from the payload is the symmetric operation.
   */
  private async syncTags(
    tx: Prisma.TransactionClient,
    userId: number,
    skills: string[] = [],
    languages: string[] = [],
  ): Promise<void> {
    await tx.candidateTag.deleteMany({ where: { candidateUserId: userId } });

    const tagIds = [
      ...(await resolveTagIds(tx, skills, 'skill')),
      ...(await resolveTagIds(tx, languages, 'language')),
    ];
    if (tagIds.length === 0) {
      return;
    }

    await tx.candidateTag.createMany({
      data: tagIds.map((tagId) => ({ candidateUserId: userId, tagId })),
      skipDuplicates: true,
    });
  }
}
