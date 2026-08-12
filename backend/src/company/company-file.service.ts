import { Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileSlotService } from '../storage/file-slot.service';
import { UploadedFile } from '../storage/uploaded-file.interface';

export type CompanyFileKind = 'logo' | 'cover-image';

const COLUMNS: Record<CompanyFileKind, 'logo' | 'coverImage'> = {
  logo: 'logo',
  'cover-image': 'coverImage',
};

@Injectable()
export class CompanyFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: FileSlotService,
  ) {}

  async replace(
    userId: number,
    kind: CompanyFileKind,
    file: UploadedFile | undefined,
  ): Promise<Company> {
    const company = await this.requireCompany(userId);
    const column = COLUMNS[kind];

    return this.slots.replace({
      kind,
      // The company id, not the caller's. Two recruiters of the same company
      // share these two files, so keying them per account would make the second
      // upload look like a different file and orphan the first.
      ownerId: company.id,
      file,
      previousKey: company[column],
      persist: (key) =>
        this.prisma.company.update({
          where: { id: company.id },
          data: { [column]: key },
        }),
    });
  }

  async remove(userId: number, kind: CompanyFileKind): Promise<Company> {
    const company = await this.requireCompany(userId);
    const column = COLUMNS[kind];

    return this.slots.remove({
      previousKey: company[column],
      persist: () =>
        this.prisma.company.update({
          where: { id: company.id },
          data: { [column]: null },
        }),
    });
  }

  /**
   * Ownership is resolved through the caller's recruiter profile, so no request
   * ever names the company it writes to. There is nothing to forge.
   */
  private async requireCompany(userId: number): Promise<Company> {
    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    });
    if (!profile) {
      throw new NotFoundException('Recruiter has no company');
    }

    return profile.company;
  }
}
