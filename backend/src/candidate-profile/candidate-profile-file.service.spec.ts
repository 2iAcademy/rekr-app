import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { pdfBuffer, pngBuffer } from '../../test/file-fixtures';
import { InMemoryFileStorage } from '../../test/in-memory-file-storage';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE } from '../storage/file-storage.interface';
import { FileSlotService } from '../storage/file-slot.service';
import { buildStorageKey, parseStorageKey } from '../storage/storage-key';
import { UploadedFile } from '../storage/uploaded-file.interface';
import { CandidateProfileFileService } from './candidate-profile-file.service';

type PrismaMock = {
  candidateProfile: { findUnique: jest.Mock; update: jest.Mock };
};

const upload = (buffer: Buffer): UploadedFile => ({
  buffer,
  size: buffer.length,
  originalname: 'upload.bin',
  mimetype: 'application/octet-stream',
});

describe('CandidateProfileFileService', () => {
  let service: CandidateProfileFileService;
  let prisma: PrismaMock;
  let storage: InMemoryFileStorage;

  beforeEach(async () => {
    prisma = {
      candidateProfile: {
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ userId: 42, ...data }),
          ),
      },
    };
    storage = new InMemoryFileStorage();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidateProfileFileService,
        FileSlotService,
        { provide: PrismaService, useValue: prisma },
        { provide: FILE_STORAGE, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(CandidateProfileFileService);
  });

  describe('replace', () => {
    it('writes the picture key on the caller row only', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        picture: null,
      });

      await service.replace(42, 'picture', upload(pngBuffer()));

      const [key] = storage.keys();
      expect(parseStorageKey(key)).toEqual({
        scope: 'candidates',
        ownerId: 42,
        kind: 'picture',
        extension: 'png',
      });
      expect(prisma.candidateProfile.update).toHaveBeenCalledWith({
        where: { userId: 42 },
        data: { picture: key },
      });
    });

    it('writes the CV key in cvUrl, not in picture', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        cvUrl: null,
      });

      await service.replace(42, 'cv', upload(pdfBuffer()));

      expect(prisma.candidateProfile.update).toHaveBeenCalledWith({
        where: { userId: 42 },
        data: { cvUrl: storage.keys()[0] },
      });
    });

    it('replaces the file the row already pointed at', async () => {
      const previousKey = buildStorageKey('candidates', 42, 'picture', 'png');
      await storage.save(previousKey, pngBuffer());
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        picture: previousKey,
      });

      await service.replace(42, 'picture', upload(pngBuffer()));

      expect(storage.keys()).toHaveLength(1);
      expect(storage.keys()[0]).not.toBe(previousKey);
    });

    it('answers 404 and stores nothing when the candidate has no profile', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.replace(42, 'picture', upload(pngBuffer())),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(storage.keys()).toHaveLength(0);
      expect(prisma.candidateProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('clears the column and deletes the file', async () => {
      const previousKey = buildStorageKey('candidates', 42, 'cv', 'pdf');
      await storage.save(previousKey, pdfBuffer());
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        cvUrl: previousKey,
      });

      await service.remove(42, 'cv');

      expect(prisma.candidateProfile.update).toHaveBeenCalledWith({
        where: { userId: 42 },
        data: { cvUrl: null },
      });
      expect(storage.keys()).toHaveLength(0);
    });

    it('answers 404 when the candidate has no profile', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(service.remove(42, 'cv')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('accepts removing a file that was never uploaded', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        cvUrl: null,
      });

      await expect(service.remove(42, 'cv')).resolves.toBeDefined();
    });
  });

  describe('readCv', () => {
    it('returns the stored bytes with the pdf content type', async () => {
      const key = buildStorageKey('candidates', 42, 'cv', 'pdf');
      await storage.save(key, pdfBuffer());
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        cvUrl: key,
      });

      await expect(service.readCv(42)).resolves.toEqual({
        content: pdfBuffer(),
        contentType: 'application/pdf',
      });
    });

    it('answers 404 when no CV was uploaded', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue({
        userId: 42,
        cvUrl: null,
      });

      await expect(service.readCv(42)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('answers 404 when the candidate has no profile', async () => {
      prisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(service.readCv(42)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
