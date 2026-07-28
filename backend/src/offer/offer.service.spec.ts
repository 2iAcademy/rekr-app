import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OfferService } from './offer.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  offer: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  recruiterProfile: { findUnique: jest.Mock };
  offerTag: { deleteMany: jest.Mock; createMany: jest.Mock };
  tag: { createMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const buildPrismaMock = (): PrismaMock => {
  const mock: PrismaMock = {
    offer: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    recruiterProfile: { findUnique: jest.fn() },
    offerTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    tag: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
};

describe('OfferService', () => {
  let service: OfferService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [OfferService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(OfferService);
  });

  describe('create', () => {
    it("creates an offer bound to the recruiter's company", async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });
      prisma.offer.create.mockResolvedValue({ id: 50, companyId: 10 });

      const result = await service.create(7, {
        title: 'Dev Front',
        contractType: 'CDI',
      });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: {
          title: 'Dev Front',
          contractType: 'CDI',
          companyId: 10,
          createdById: 7,
        },
      });
      expect(result).toEqual(expect.objectContaining({ id: 50 }));
    });

    it('rejects create when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.create(7, { title: 'Dev Front' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.offer.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("updates an offer of the recruiter's company", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 10 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });
      prisma.offer.update.mockResolvedValue({ id: 50, title: 'Dev Senior' });

      const result = await service.update(7, 50, { title: 'Dev Senior' });

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { title: 'Dev Senior' },
      });
      expect(result).toEqual(expect.objectContaining({ id: 50 }));
    });

    it('rejects update of an offer from another company (403)', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 99 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });

      await expect(
        service.update(7, 50, { title: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('rejects update of a missing offer (404)', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(
        service.update(7, 50, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.offer.update).not.toHaveBeenCalled();
    });
  });
});
