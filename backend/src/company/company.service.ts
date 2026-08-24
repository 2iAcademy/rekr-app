import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CityService, type Coordinates } from '../city/city.service';
import { resolveTagIds } from '../common/tags/tag-sync';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CityService,
  ) {}

  async create(userId: number, dto: CreateCompanyDto) {
    const { firstName, lastName, jobTitle, benefits, ...companyData } = dto;

    // Conflict first, same as `updateMine` checks the company exists before
    // judging its location: a recruiter who already has one deserves the 409,
    // not a complaint about the commune. The transaction repeats the check,
    // which is what makes it race-proof.
    const taken = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (taken) {
      throw new ConflictException('Recruiter already has a company');
    }

    const coordinates = await this.cities.assertKnown(dto);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.recruiterProfile.findUnique({
        where: { userId },
      });
      if (existing) {
        throw new ConflictException('Recruiter already has a company');
      }

      const company = await tx.company.create({
        data: { ...companyData, ...(coordinates ?? {}) },
      });
      await tx.recruiterProfile.create({
        data: { userId, companyId: company.id, firstName, lastName, jobTitle },
      });

      if (benefits) {
        await this.syncBenefits(tx, company.id, benefits);
      }

      return company;
    });
  }

  async updateMine(userId: number, dto: UpdateCompanyDto) {
    const { firstName, lastName, jobTitle, benefits, ...companyData } = dto;
    let coordinates: Coordinates | null = null;

    if (dto.city !== undefined || dto.postalCode !== undefined) {
      // Read outside the transaction on purpose: verifying the pair goes over
      // the network, and an open transaction must not wait on a third party.
      // Verified only once the company is known to exist, so a bad location
      // cannot answer 400 where the request deserves the 404 below.
      const profile = await this.prisma.recruiterProfile.findUnique({
        where: { userId },
        select: { company: { select: { city: true, postalCode: true } } },
      });

      if (profile) {
        coordinates = await this.cities.assertKnown({
          city: dto.city ?? profile.company.city,
          postalCode: dto.postalCode ?? profile.company.postalCode,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.recruiterProfile.findUnique({
        where: { userId },
      });
      if (!profile) {
        throw new NotFoundException('Recruiter has no company');
      }

      // Split across the two tables the same way `create` writes them, so the
      // wizard can replay its whole payload instead of losing the identity half.
      await tx.recruiterProfile.update({
        where: { userId },
        data: { firstName, lastName, jobTitle },
      });

      const company = await tx.company.update({
        where: { id: profile.companyId },
        data: { ...companyData, ...(coordinates ?? {}) },
      });

      if (benefits) {
        await this.syncBenefits(tx, company.id, benefits);
      }

      return company;
    });
  }

  private async syncBenefits(
    tx: Prisma.TransactionClient,
    companyId: number,
    benefits: string[],
  ): Promise<void> {
    // `companyTag` rows are only ever written here, and benefits are the only
    // category a company links, so wiping the set and re-creating it from the
    // payload is the symmetric operation.
    await tx.companyTag.deleteMany({ where: { companyId } });

    const tagIds = await resolveTagIds(tx, benefits, 'benefit');
    if (tagIds.length === 0) {
      return;
    }

    await tx.companyTag.createMany({
      data: tagIds.map((tagId) => ({ companyId, tagId })),
      skipDuplicates: true,
    });
  }
}
