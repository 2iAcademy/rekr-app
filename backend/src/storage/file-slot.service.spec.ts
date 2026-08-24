import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jpegBuffer, pdfBuffer, pngBuffer } from '../../test/file-fixtures';
import { InMemoryFileStorage } from '../../test/in-memory-file-storage';
import { FILE_STORAGE } from './file-storage.interface';
import { FileSlotService } from './file-slot.service';
import { buildStorageKey, parseStorageKey } from './storage-key';
import { UploadedFile } from './uploaded-file.interface';

const upload = (buffer: Buffer): UploadedFile => ({
  buffer,
  size: buffer.length,
  originalname: 'upload.bin',
  mimetype: 'application/octet-stream',
});

describe('FileSlotService', () => {
  let service: FileSlotService;
  let storage: InMemoryFileStorage;

  beforeEach(async () => {
    storage = new InMemoryFileStorage();

    const moduleRef = await Test.createTestingModule({
      providers: [
        FileSlotService,
        { provide: FILE_STORAGE, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(FileSlotService);
  });

  describe('replace', () => {
    it('stores the bytes and hands the new key to the persist callback', async () => {
      const persist = jest.fn().mockResolvedValue({ ok: true });

      const result = await service.replace({
        kind: 'cv',
        ownerId: 12,
        file: upload(pdfBuffer()),
        previousKey: null,
        persist,
      });

      expect(result).toEqual({ ok: true });
      const [key] = storage.keys();
      expect(parseStorageKey(key)).toEqual({
        scope: 'candidates',
        ownerId: 12,
        kind: 'cv',
        extension: 'pdf',
      });
      expect(persist).toHaveBeenCalledWith(key);
    });

    it('derives the extension from the bytes, not from the caller', async () => {
      await service.replace({
        kind: 'picture',
        ownerId: 1,
        file: upload(jpegBuffer()),
        previousKey: null,
        persist: jest.fn().mockResolvedValue(null),
      });

      expect(parseStorageKey(storage.keys()[0])?.extension).toBe('jpg');
    });

    it('drops the previous file once the new key is persisted', async () => {
      const previousKey = buildStorageKey('candidates', 1, 'picture', 'png');
      await storage.save(previousKey, pngBuffer());

      await service.replace({
        kind: 'picture',
        ownerId: 1,
        file: upload(jpegBuffer()),
        previousKey,
        persist: jest.fn().mockResolvedValue(null),
      });

      expect(await storage.read(previousKey)).toBeNull();
      expect(storage.keys()).toHaveLength(1);
    });

    it('keeps the previous file when persisting fails', async () => {
      const previousKey = buildStorageKey('candidates', 1, 'picture', 'png');
      await storage.save(previousKey, pngBuffer());
      const persist = jest
        .fn()
        .mockRejectedValue(new Error('constraint violation'));

      await expect(
        service.replace({
          kind: 'picture',
          ownerId: 1,
          file: upload(jpegBuffer()),
          previousKey,
          persist,
        }),
      ).rejects.toThrow('constraint violation');

      expect(await storage.read(previousKey)).toEqual(pngBuffer());
    });

    it('still succeeds when the previous file can no longer be deleted', async () => {
      const previousKey = buildStorageKey('candidates', 1, 'picture', 'png');
      await storage.save(previousKey, pngBuffer());
      jest
        .spyOn(storage, 'delete')
        .mockRejectedValue(new Error('EACCES: read-only filesystem'));

      await expect(
        service.replace({
          kind: 'picture',
          ownerId: 1,
          file: upload(jpegBuffer()),
          previousKey,
          persist: jest.fn().mockResolvedValue({ ok: true }),
        }),
      ).resolves.toEqual({ ok: true });
    });

    it('refuses an unsupported format without touching the storage', async () => {
      const persist = jest.fn();

      await expect(
        service.replace({
          kind: 'cv',
          ownerId: 1,
          file: upload(pngBuffer()),
          previousKey: null,
          persist,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storage.keys()).toHaveLength(0);
      expect(persist).not.toHaveBeenCalled();
    });

    it('refuses a missing file without touching the storage', async () => {
      await expect(
        service.replace({
          kind: 'cv',
          ownerId: 1,
          file: undefined,
          previousKey: null,
          persist: jest.fn(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storage.keys()).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('clears the slot then deletes the file', async () => {
      const previousKey = buildStorageKey('candidates', 1, 'cv', 'pdf');
      await storage.save(previousKey, pdfBuffer());
      const persist = jest.fn().mockResolvedValue({ cleared: true });

      const result = await service.remove({ previousKey, persist });

      expect(result).toEqual({ cleared: true });
      expect(persist).toHaveBeenCalledWith(null);
      expect(storage.keys()).toHaveLength(0);
    });

    it('keeps the file when clearing the slot fails', async () => {
      const previousKey = buildStorageKey('candidates', 1, 'cv', 'pdf');
      await storage.save(previousKey, pdfBuffer());

      await expect(
        service.remove({
          previousKey,
          persist: jest.fn().mockRejectedValue(new Error('deadlock')),
        }),
      ).rejects.toThrow('deadlock');

      expect(await storage.read(previousKey)).toEqual(pdfBuffer());
    });

    it('is a no-op on an already empty slot', async () => {
      const persist = jest.fn().mockResolvedValue({ cleared: true });

      const result = await service.remove({ previousKey: null, persist });

      expect(result).toEqual({ cleared: true });
      expect(persist).toHaveBeenCalledWith(null);
    });
  });

  describe('read', () => {
    it('returns the stored bytes', async () => {
      const key = buildStorageKey('candidates', 1, 'cv', 'pdf');
      await storage.save(key, pdfBuffer());

      expect(await service.read(key)).toEqual(pdfBuffer());
    });

    it('answers 404 for an empty slot', async () => {
      await expect(service.read(null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('answers 404 when the row points at a file that is gone', async () => {
      const key = buildStorageKey('candidates', 1, 'cv', 'pdf');

      await expect(service.read(key)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers 404 rather than reading a key that is not one of ours', async () => {
      await expect(service.read('../../../etc/passwd')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
