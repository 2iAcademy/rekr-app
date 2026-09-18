import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { CompanyService } from './company.service';
import { CityService } from '../city/city.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  company: { create: jest.Mock; update: jest.Mock };
  recruiterProfile: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
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
    $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
};

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let cities: { assertKnown: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    cities = { assertKnown: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: PrismaService, useValue: prisma },
        { provide: CityService, useValue: cities },
      ],
    }).compile();
    service = moduleRef.get(CompanyService);
  });

  describe('city verification', () => {
    it('submits the location of a new company to the city reference', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);
      prisma.company.create.mockResolvedValue({ id: 10 });

      await service.create(7, {
        name: 'Acme',
        firstName: 'R',
        lastName: 'D',
        city: 'Lyon',
        postalCode: '69001',
      });

      expect(cities.assertKnown).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Lyon', postalCode: '69001' }),
      );
    });

    it('writes nothing when the reference refuses the location of a new company', async () => {
      cities.assertKnown.mockRejectedValue(new BadRequestException());

      await expect(
        service.create(7, {
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          city: 'Wakanda',
          postalCode: '99999',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    // A patch may carry only one half of the pair; the other half is whatever
    // the company already holds, and that is what has to be verified.
    it('verifies a patched city against the postcode already stored', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        userId: 7,
        companyId: 10,
        company: { city: 'Lyon', postalCode: '69001' },
      });
      prisma.company.update.mockResolvedValue({ id: 10 });

      await service.updateMine(7, { city: 'Nîmes' });

      expect(cities.assertKnown).toHaveBeenCalledWith({
        city: 'Nîmes',
        postalCode: '69001',
      });
    });

    it('leaves the reference alone when the patch does not touch the location', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue({
        userId: 7,
        companyId: 10,
        company: { city: 'Lyon', postalCode: '69001' },
      });
      prisma.company.update.mockResolvedValue({ id: 10 });

      await service.updateMine(7, { name: 'Acme Renamed' });

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });

    // The recruiter owns no company yet: answering 400 on the location would
    // hide the 404 the request actually deserves.
    it('does not verify anything when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMine(7, { city: 'Lyon', postalCode: '69001' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(cities.assertKnown).not.toHaveBeenCalled();
    });
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

  describe('findMine', () => {
    const profileRow = (company: Record<string, unknown> = {}) => ({
      firstName: 'Rick',
      lastName: 'Deckard',
      jobTitle: 'CTO',
      company: {
        id: 10,
        name: 'Acme',
        latitude: null,
        longitude: null,
        ...company,
      },
    });

    it('rejects a read when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(service.findMine(7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // The company is reached through the caller's own profile: no request
    // names it, so none can name someone else's.
    it('resolves the company through the caller', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(profileRow());

      await service.findMine(7);

      expect(prisma.recruiterProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });

    /**
     * The perks now belong to the offer, where they differ from one post to the
     * next. Reading them back here would resurrect a field the recruiter can no
     * longer edit on this screen.
     */
    it('reports no benefits on the company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(profileRow());

      const result = await service.findMine(7);

      expect(result).not.toHaveProperty('benefits');
    });

    it('renders the coordinates as strings', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(
        profileRow({
          latitude: new Prisma.Decimal('45.7580000'),
          longitude: new Prisma.Decimal('4.8350000'),
        }),
      );

      const result = await service.findMine(7);

      expect(result.latitude).toBe('45.758');
      expect(result.longitude).toBe('4.835');
    });

    it('keeps an unset coordinate null rather than stringifying it', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(profileRow());

      const result = await service.findMine(7);

      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
    });

    // The identity lives on `recruiter_profile`, so it is nested rather than
    // read as company data.
    it('nests the recruiter identity', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(profileRow());

      const result = await service.findMine(7);

      expect(result.recruiter).toEqual({
        firstName: 'Rick',
        lastName: 'Deckard',
        jobTitle: 'CTO',
      });
    });
  });
});
