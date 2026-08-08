import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CompanyService } from './company.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  company: { create: jest.Mock; update: jest.Mock };
  recruiterProfile: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  companyTag: { deleteMany: jest.Mock; createMany: jest.Mock };
  tag: { createMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const buildPrismaMock = (): PrismaMock => {
  const mock: PrismaMock = {
    company: { create: jest.fn(), update: jest.fn() },
    recruiterProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    companyTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    tag: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
};

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [CompanyService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CompanyService);
  });

  describe('create', () => {
    it('creates the company and links a recruiter profile to it', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);
      prisma.company.create.mockResolvedValue({ id: 10, name: 'Acme' });
      prisma.recruiterProfile.create.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });

      const result = await service.create(7, {
        name: 'Acme',
        firstName: 'Rick',
        lastName: 'Deckard',
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { name: 'Acme' },
      });
      expect(prisma.recruiterProfile.create).toHaveBeenCalledWith({
        data: {
          userId: 7,
          companyId: 10,
          firstName: 'Rick',
          lastName: 'Deckard',
        },
      });
      expect(result).toEqual(expect.objectContaining({ id: 10, name: 'Acme' }));
    });

    it('rejects creation when the recruiter already has a company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 5,
      });

      await expect(
        service.create(7, { name: 'Acme', firstName: 'R', lastName: 'D' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.company.create).not.toHaveBeenCalled();
    });
  });

  describe('updateMine', () => {
    it('updates the company linked to the recruiter', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });
      prisma.company.update.mockResolvedValue({ id: 10, name: 'Acme 2' });

      const result = await service.updateMine(7, { name: 'Acme 2' });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { name: 'Acme 2' },
      });
      expect(result).toEqual(
        expect.objectContaining({ id: 10, name: 'Acme 2' }),
      );
    });

    // The identity fields live on `recruiterProfile`, not on `company`: routing
    // them to the company update would drop them without any error.
    it('routes the recruiter identity to its own table', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });
      prisma.company.update.mockResolvedValue({ id: 10, name: 'Acme 2' });

      await service.updateMine(7, {
        name: 'Acme 2',
        firstName: 'Rachael',
        lastName: 'Tyrell',
        jobTitle: 'CTO',
      });

      expect(prisma.recruiterProfile.update).toHaveBeenCalledWith({
        where: { userId: 7 },
        data: { firstName: 'Rachael', lastName: 'Tyrell', jobTitle: 'CTO' },
      });
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { name: 'Acme 2' },
      });
    });

    it('rejects update when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(service.updateMine(7, { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(prisma.company.update).not.toHaveBeenCalled();
    });
  });
});
