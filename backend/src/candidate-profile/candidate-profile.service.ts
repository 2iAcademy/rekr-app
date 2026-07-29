import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { resolveTagIds } from '../common/tags/tag-sync';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@Injectable()
export class CandidateProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateCandidateProfileDto) {
    const { skills, ...profileData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidateProfile.findUnique({
        where: { userId },
      });
      if (existing) {
        throw new ConflictException('Candidate profile already exists');
      }

      const profile = await tx.candidateProfile.create({
        data: { ...profileData, userId },
      });

      if (skills) {
        await this.syncSkills(tx, userId, skills);
      }

      return profile;
    });
  }

  async update(userId: number, dto: UpdateCandidateProfileDto) {
    const { skills, ...profileData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidateProfile.findUnique({
        where: { userId },
      });
      if (!existing) {
        throw new NotFoundException('Candidate profile not found');
      }

      const profile = await tx.candidateProfile.update({
        where: { userId },
        data: { ...profileData },
      });

      if (skills) {
        await this.syncSkills(tx, userId, skills);
      }

      return profile;
    });
  }

  private async syncSkills(
    tx: Prisma.TransactionClient,
    userId: number,
    skills: string[],
  ): Promise<void> {
    // No `tag: { category }` filter here on purpose. `resolveTagIds` reuses a
    // label whatever category it was first stored under, so a skill linked
    // from a label created earlier as a benefit would never match a
    // category-filtered delete and would become impossible to remove.
    // `candidateTag` rows are only ever written by this method, so deleting
    // them all and re-creating from the payload is the symmetric operation.
    await tx.candidateTag.deleteMany({ where: { candidateUserId: userId } });

    const tagIds = await resolveTagIds(tx, skills, 'skill');
    if (tagIds.length === 0) {
      return;
    }

    await tx.candidateTag.createMany({
      data: tagIds.map((tagId) => ({ candidateUserId: userId, tagId })),
      skipDuplicates: true,
    });
  }
}
