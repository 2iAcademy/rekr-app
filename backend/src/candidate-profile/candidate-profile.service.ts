import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TagCategory } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateFeedItemDto } from './dto/candidate-feed-item.dto';
import { CandidateFeedQueryDto } from './dto/candidate-feed-query.dto';
import { CandidateProfileResponseDto } from './dto/candidate-profile-response.dto';
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
    };
  }

  /**
   * The recruiter deck: every candidate this recruiter has not answered yet.
   *
   * Reserved to a recruiter attached to a company, on the same terms as
   * `OfferService.create`: signup is self-service and unverified, so the
   * company is the only thing standing between an address anyone can register
   * and the whole pool of candidates.
   *
   * Read with an explicit `select` rather than an `include`, and mapped onto
   * `CandidateFeedItemDto`: this row belongs to a stranger, so a column added
   * to `candidate_profile` later must not reach a recruiter just because it was
   * added.
   */
  async findFeed(
    recruiterUserId: number,
    query: CandidateFeedQueryDto,
  ): Promise<CandidateFeedItemDto[]> {
    const {
      limit,
      contractType,
      experienceLevel,
      availability,
      remotePolicy,
      city,
    } = query;

    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId: recruiterUserId },
    });
    if (!profile) {
      throw new NotFoundException('Recruiter has no company');
    }

    const profiles = await this.prisma.candidateProfile.findMany({
      where: {
        user: {
          isActive: true,
          likesReceived: { none: { recruiterUserId } },
          passesReceived: { none: { recruiterUserId } },
        },
        // `contractTypes` is a list, so a filter on it is a membership test.
        ...(contractType ? { contractTypes: { has: contractType } } : {}),
        ...(experienceLevel ? { experienceLevel } : {}),
        ...(availability ? { availability } : {}),
        ...(remotePolicy ? { remotePolicy } : {}),
        ...(city
          ? { city: { equals: city, mode: 'insensitive' as const } }
          : {}),
      },
      // `userId` breaks the ties `createdAt` leaves: without it two profiles
      // written in the same instant can swap places from one read to the next,
      // and the order of the deck stops being reproducible.
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: limit,
      select: {
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
        // Same detour as `findMine`: `candidate_tag` is keyed on the user, and
        // selecting nothing else off that relation keeps the account columns
        // out of reach.
        user: {
          select: {
            candidateTags: {
              orderBy: { tag: { label: 'asc' } },
              select: { tag: { select: { label: true } } },
            },
          },
        },
      },
    });

    return profiles.map(({ user, ...fields }) => ({
      ...fields,
      tags: user.candidateTags.map((link) => link.tag.label),
    }));
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
