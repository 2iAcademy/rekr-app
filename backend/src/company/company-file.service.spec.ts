import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { pdfBuffer, pngBuffer, webpBuffer } from '../../test/file-fixtures';
import { InMemoryFileStorage } from '../../test/in-memory-file-storage';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE } from '../storage/file-storage.interface';
import { FileSlotService } from '../storage/file-slot.service';
import { buildStorageKey, parseStorageKey } from '../storage/storage-key';
import { UploadedFile } from '../storage/uploaded-file.interface';
import { CompanyFileService } from './company-file.service';

type PrismaMock = {
  recruiterProfile: { findUnique: jest.Mock };
  company: { update: jest.Mock };
};

const upload = (buffer: Buffer): UploadedFile => ({
  buffer,
  size: buffer.length,
  originalname: 'upload.bin',
  mimetype: 'application/octet-stream',
});

describe('CompanyFileService', () => {
  let service: CompanyFileService;
  let prisma: PrismaMock;
  let storage: InMemoryFileStorage;

  beforeEach(async () => {
    prisma = {
      recruiterProfile: { findUnique: jest.fn() },
      company: {
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ id: 7, ...data }),
          ),
      },
    };
    storage = new InMemoryFileStorage();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CompanyFileService,
        FileSlotService,
        { provide: PrismaService, useValue: prisma },
        { provide: FILE_STORAGE, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(CompanyFileService);
  });

  const recruiterOf = (companyId: number, company: object = {}) =>
    prisma.recruiterProfile.findUnique.mockResolvedValue({
      userId: 42,
      companyId,
      company: { id: companyId, logo: null, coverImage: null, ...company },
    });

  describe('replace', () => {
    it('scopes the key to the company, never to the recruiter account', async () => {
      recruiterOf(7);

      await service.replace(42, 'logo', upload(pngBuffer()));

      expect(parseStorageKey(storage.keys()[0])).toEqual({
        scope: 'companies',
        ownerId: 7,
        kind: 'logo',
        extension: 'png',
      });
    });

    it('updates the company the recruiter belongs to', async () => {
      recruiterOf(7);

      await service.replace(42, 'logo', upload(pngBuffer()));

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { logo: storage.keys()[0] },
      });
    });

    it('writes the cover image in its own column', async () => {
      recruiterOf(7);

      await service.replace(42, 'cover-image', upload(webpBuffer()));

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { coverImage: storage.keys()[0] },
      });
    });

    it('replaces the previous logo', async () => {
      const previousKey = buildStorageKey('companies', 7, 'logo', 'png');
      await storage.save(previousKey, pngBuffer());
      recruiterOf(7, { logo: previousKey });

      await service.replace(42, 'logo', upload(webpBuffer()));

      expect(storage.keys()).toHaveLength(1);
      expect(await storage.read(previousKey)).toBeNull();
    });

    it('leaves the cover image alone when the logo changes', async () => {
      const coverKey = buildStorageKey('companies', 7, 'cover-image', 'png');
      await storage.save(coverKey, pngBuffer());
      recruiterOf(7, { coverImage: coverKey });

      await service.replace(42, 'logo', upload(webpBuffer()));

      expect(await storage.read(coverKey)).toEqual(pngBuffer());
    });

    it('answers 404 and stores nothing when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.replace(42, 'logo', upload(pngBuffer())),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(storage.keys()).toHaveLength(0);
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('refuses a PDF as a logo', async () => {
      recruiterOf(7);

      await expect(
        service.replace(42, 'logo', upload(pdfBuffer())),
      ).rejects.toThrow();
      expect(storage.keys()).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('clears the column and deletes the file', async () => {
      const previousKey = buildStorageKey('companies', 7, 'logo', 'png');
      await storage.save(previousKey, pngBuffer());
      recruiterOf(7, { logo: previousKey });

      await service.remove(42, 'logo');

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { logo: null },
      });
      expect(storage.keys()).toHaveLength(0);
    });

    it('answers 404 when the recruiter has no company', async () => {
      prisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(service.remove(42, 'logo')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
