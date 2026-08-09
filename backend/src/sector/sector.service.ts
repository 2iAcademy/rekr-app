import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SectorService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.sector.findMany({
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });
  }
}
