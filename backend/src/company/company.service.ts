import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CityService, type Coordinates } from '../city/city.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CityService,
  ) {}

  async create(userId: number, dto: CreateCompanyDto) {
    const { firstName, lastName, jobTitle, ...companyData } = dto;

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

      return company;
    });
  }

  /**
   * Reads the company of the caller, resolved through their recruiter profile.
   * No request ever names the company it reads, so there is nothing to forge —
   * the same property `updateMine` and the file slots rely on.
   *
   * The columns are spelled out instead of relying on a bare `findUnique`: this
   * is the row the account screen renders, and a column added to `company`
   * later must not reach a client just because it was added.
   */
  async findMine(userId: number): Promise<CompanyResponseDto> {
    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
      select: {
        firstName: true,
        lastName: true,
        jobTitle: true,
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            size: true,
            sectorId: true,
            description: true,
            siteUrl: true,
            coverImage: true,
            city: true,
            postalCode: true,
            latitude: true,
            longitude: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Recruiter has no company');
    }

    const { latitude, longitude, ...company } = profile.company;

    return {
      ...company,
      latitude: latitude?.toString() ?? null,
      longitude: longitude?.toString() ?? null,
      recruiter: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        jobTitle: profile.jobTitle,
      },
    };
  }

  async updateMine(userId: number, dto: UpdateCompanyDto) {
    const { firstName, lastName, jobTitle, ...companyData } = dto;
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

      return company;
    });
  }
}
