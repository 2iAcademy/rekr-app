import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JobFamilyService } from './job-family.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobFamilyService', () => {
  let service: JobFamilyService;
  let prisma: { jobFamily: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { jobFamily: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        JobFamilyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(JobFamilyService);
  });

  it('lists job families in label order', async () => {
    prisma.jobFamily.findMany.mockResolvedValue([
      { id: 5, label: 'Bâtiment & Travaux publics' },
      { id: 13, label: 'Informatique & Numérique' },
    ]);

    const result = await service.findAll();

    expect(prisma.jobFamily.findMany).toHaveBeenCalledWith({
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });
    expect(result).toEqual([
      { id: 5, label: 'Bâtiment & Travaux publics' },
      { id: 13, label: 'Informatique & Numérique' },
    ]);
  });

  it('returns an empty list when the reference table is empty', async () => {
    prisma.jobFamily.findMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('accepts ids the reference table carries', async () => {
    prisma.jobFamily.findMany.mockResolvedValue([{ id: 5 }, { id: 13 }]);

    await expect(service.assertKnown([5, 13])).resolves.toBeUndefined();
  });

  // The duplicate is collapsed before the count comparison: without it, asking
  // for `[5, 5]` reads two wanted against one row and rejects a valid payload.
  it('accepts a repeated id without counting it twice', async () => {
    prisma.jobFamily.findMany.mockResolvedValue([{ id: 5 }]);

    await expect(service.assertKnown([5, 5])).resolves.toBeUndefined();
  });

  it('rejects an id the reference table does not carry', async () => {
    prisma.jobFamily.findMany.mockResolvedValue([{ id: 5 }]);

    await expect(service.assertKnown([5, 999])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reads nothing when no id is given', async () => {
    await expect(service.assertKnown([])).resolves.toBeUndefined();
    expect(prisma.jobFamily.findMany).not.toHaveBeenCalled();
  });
});
