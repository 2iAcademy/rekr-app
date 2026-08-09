import { Test } from '@nestjs/testing';
import { SectorService } from './sector.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SectorService', () => {
  let service: SectorService;
  let prisma: { sector: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { sector: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [SectorService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SectorService);
  });

  it('lists sectors in label order', async () => {
    prisma.sector.findMany.mockResolvedValue([
      { id: 3, label: 'Bâtiment & Travaux publics' },
      { id: 1, label: 'Informatique & Numérique' },
    ]);

    const result = await service.findAll();

    expect(prisma.sector.findMany).toHaveBeenCalledWith({
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });
    expect(result).toEqual([
      { id: 3, label: 'Bâtiment & Travaux publics' },
      { id: 1, label: 'Informatique & Numérique' },
    ]);
  });

  it('returns an empty list when the reference table is empty', async () => {
    prisma.sector.findMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });
});
