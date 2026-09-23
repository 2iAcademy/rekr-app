import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TagCategory } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import { JobFamilyService } from '../job-family/job-family.service';
import { primaryJobFamilyOf } from '../search/ranking/offer-ranking';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateProfileResponseDto } from './dto/candidate-profile-response.dto';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@Injectable()
export class CandidateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CityService,
    private readonly jobFamilies: JobFamilyService,
  ) {}

  async create(userId: number, dto: CreateCandidateProfileDto) {
    const { skills, languages, jobFamilyIds, ...profileData } = dto;

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

    await this.jobFamilies.assertKnown(jobFamilyIds ?? []);
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

      if (jobFamilyIds) {
        await this.syncJobFamilies(tx, userId, jobFamilyIds);
      }

      return profile;
    });
  }

  /**
   * Reads the caller's own profile. There is no parameter to tamper with: the
   * row is keyed on the token subject, so no other profile is addressable.
   *
   * The columns are spelled out instead of relying on a bare `findUnique`. This
   * is the row the account screen renders, and a column added to
   * `candidate_profile` later must not reach a client just because it was added.
   */
  async findMine(userId: number): Promise<CandidateProfileResponseDto> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        picture: true,
        bio: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        desiredJobTitle: true,
        contractTypes: true,
        experienceLevel: true,
        availability: true,
        availabilityDelayMonths: true,
        availabilityDate: true,
        remotePolicy: true,
        mobilityRadiusKm: true,
        mobilityNationwide: true,
        salaryMin: true,
        salaryMax: true,
        linkedinUrl: true,
        cvUrl: true,
        createdAt: true,
        updatedAt: true,
        // `candidate_tag` is keyed on the user, not on the profile, so the tags
        // hang off the `user` relation. Reaching them from here keeps the read
        // to a single query, and selecting nothing else off that relation keeps
        // the account columns — `passwordHash` first — out of reach.
        user: {
          select: {
            candidateTags: {
              orderBy: { tag: { label: 'asc' } },
              select: { tag: { select: { label: true, category: true } } },
            },
            // Primary first: the rank is the candidate's preference, and the
            // form reads the first trade as the one they ranked highest.
            candidateJobFamilies: {
              orderBy: [{ rank: 'asc' }, { jobFamilyId: 'asc' }],
              select: { jobFamilyId: true, rank: true },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }

    const { user, latitude, longitude, ...fields } = profile;
    const labelsOf = (category: TagCategory): string[] =>
      user.candidateTags
        .filter((link) => link.tag.category === category)
        .map((link) => link.tag.label);

    return {
      ...fields,
      latitude: latitude?.toString() ?? null,
      longitude: longitude?.toString() ?? null,
      skills: labelsOf('skill'),
      languages: labelsOf('language'),
      jobFamilyIds: user.candidateJobFamilies.map((link) => link.jobFamilyId),
      primaryJobFamilyId: primaryJobFamilyOf(user.candidateJobFamilies),
    };
  }

  async update(userId: number, dto: UpdateCandidateProfileDto) {
    const { skills, languages, jobFamilyIds, ...profileData } = dto;

    if (jobFamilyIds) {
      await this.jobFamilies.assertKnown(jobFamilyIds);
    }
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
      // Two saves of one account wait for each other: a patch carrying only the
      // trades takes no row lock, and both wipe-and-rewrites kept their union.
      await tx.$queryRaw`SELECT 1 FROM candidate_profile WHERE fk_user = ${userId} FOR UPDATE`;
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

      if (jobFamilyIds) {
        await this.syncJobFamilies(tx, userId, jobFamilyIds);
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

  /**
   * Replaces the trades the candidate is looking for.
   *
   * Same wipe-and-rewrite shape as `syncTags`, for the same reason: these rows
   * are written nowhere else, so the payload is the whole truth. An empty list
   * clears the filter rather than leaving the previous trades in place, which
   * is what lets someone widen their search back to everything.
   *
   * The position in the list is persisted as the rank, 0 being the primary:
   * the array is the only place the candidate's preference is expressed.
   */
  private async syncJobFamilies(
    tx: Prisma.TransactionClient,
    userId: number,
    jobFamilyIds: number[],
  ): Promise<void> {
    await tx.candidateJobFamily.deleteMany({
      where: { candidateUserId: userId },
    });
    if (jobFamilyIds.length === 0) {
      return;
    }

    await tx.candidateJobFamily.createMany({
      data: jobFamilyIds.map((jobFamilyId, rank) => ({
        candidateUserId: userId,
        jobFamilyId,
        rank,
      })),
      skipDuplicates: true,
    });
  }
}
