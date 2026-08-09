import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OfferService } from './offer.service';
import { CityService } from '../city/city.service';
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
  let cities: { assertKnown: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    cities = { assertKnown: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OfferService,
        { provide: PrismaService, useValue: prisma },
        { provide: CityService, useValue: cities },
      ],
    }).compile();
    service = moduleRef.get(OfferService);
  });

  describe('city verification', () => {
    it('submits the location of a new offer to the city reference', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.create.mockResolvedValue({ id: 50, companyId: 10 });

      await service.create(7, {
        title: 'Dev',
        city: 'Lyon',
        postalCode: '69001',
      });

      expect(cities.assertKnown).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Lyon', postalCode: '69001' }),
      );
    });

    it('writes nothing when the reference refuses the location of a new offer', async () => {
      cities.assertKnown.mockRejectedValue(new BadRequestException());

      await expect(
        service.create(7, {
          title: 'Dev',
          city: 'Wakanda',
          postalCode: '99999',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('verifies a patched city against the postcode already stored', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 50,
        companyId: 10,
        city: 'Lyon',
        postalCode: '69001',
      });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.update.mockResolvedValue({ id: 50, companyId: 10 });

      await service.update(7, 50, { city: 'Nîmes' });

      expect(cities.assertKnown).toHaveBeenCalledWith({
        city: 'Nîmes',
        postalCode: '69001',
      });
    });

    it('leaves the reference alone when the patch does not touch the location', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 10 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });
      prisma.offer.update.mockResolvedValue({ id: 50, companyId: 10 });

      await service.update(7, 50, { title: 'Dev renommé' });

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });

    /**
     * Answering 400 on the location of an offer the caller does not own would
     * tell a stranger that the offer exists — and so would a 403. Someone
     * else's offer and a missing one give the same answer, and nothing is
     * verified until ownership is established.
     */
    it('answers 404 rather than a location error on someone else’s offer', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 50,
        companyId: 99,
        city: 'Lyon',
        postalCode: '69001',
      });
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await expect(
        service.update(7, 50, { city: 'Wakanda', postalCode: '99999' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });

    it('answers 404 rather than a location error on a missing offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 10 });

      await expect(
        service.update(7, 50, { city: 'Wakanda', postalCode: '99999' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });
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

    // Indistinguishable from a missing offer on purpose: a 403 would confirm
    // the id exists, which is all an enumeration needs.
    it('rejects update of an offer from another company (404)', async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: 50, companyId: 99 });
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        companyId: 10,
      });

      await expect(
        service.update(7, 50, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);

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
