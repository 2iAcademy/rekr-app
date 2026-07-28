import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { resolveTagIds } from '../common/tags/tag-sync';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateCompanyDto) {
    const { firstName, lastName, jobTitle, benefits, ...companyData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.recruiterProfile.findUnique({
        where: { userId },
      });
      if (existing) {
        throw new ConflictException('Recruiter already has a company');
      }

      const company = await tx.company.create({ data: { ...companyData } });
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
    const { benefits, ...companyData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.recruiterProfile.findUnique({
        where: { userId },
      });
      if (!profile) {
        throw new NotFoundException('Recruiter has no company');
      }

      const company = await tx.company.update({
        where: { id: profile.companyId },
        data: { ...companyData },
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
    // See `CandidateProfileService.syncSkills`: filtering the unlink by
    // category makes a link indelible as soon as the label pre-exists under
    // another category. `companyTag` rows are only written here.
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
