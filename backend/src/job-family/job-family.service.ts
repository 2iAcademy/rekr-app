import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobFamilyService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.jobFamily.findMany({
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });
  }

  /**
   * Refuses ids the reference table does not carry.
   *
   * Checked here rather than left to the foreign key: a bad id would otherwise
   * surface as a Prisma constraint error, which the filter turns into a 500
   * where the caller deserves a 400.
   */
  async assertKnown(ids: number[]): Promise<void> {
    const wanted = Array.from(new Set(ids));
    if (wanted.length === 0) {
      return;
    }

    const known = await this.prisma.jobFamily.findMany({
      where: { id: { in: wanted } },
      select: { id: true },
    });
    if (known.length !== wanted.length) {
      throw new BadRequestException('Unknown job family');
    }
  }
}
