import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FILE_STORAGE, type FileStorage } from './file-storage.interface';
import { FILE_KINDS, FileKind } from './file-kind';
import { buildStorageKey, isStorageKey } from './storage-key';
import { UploadedFile } from './uploaded-file.interface';
import { validateUploadedFile } from './upload-validation';

interface ReplaceParams<T> {
  kind: FileKind;
  ownerId: number;
  file: UploadedFile | undefined;
  previousKey: string | null;
  persist: (key: string) => Promise<T>;
}

interface RemoveParams<T> {
  previousKey: string | null;
  persist: (key: null) => Promise<T>;
}

/**
 * One file slot: a single column holding a single storage key.
 *
 * The four slots of this feature (`picture`, `cv_url`, `logo`, `cover_image`)
 * differ only in which row they update, so the part that is easy to get wrong —
 * the order of the three side effects — lives here once instead of four times.
 */
@Injectable()
export class FileSlotService {
  private readonly logger = new Logger(FileSlotService.name);

  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  /**
   * Write the new file, persist its key, then drop the old file — in that order.
   *
   * Deleting first is the tempting order and it is the one that loses data: if
   * persisting then fails, the column still points at a file that no longer
   * exists, and the profile has a broken image with no way back. This order can
   * only ever leave an unreferenced file behind, which costs disk and nothing
   * else.
   *
   * The final delete is best-effort for the same reason: the request has already
   * succeeded once the key is committed, and failing it because a stale file
   * could not be unlinked would report a false error for work that was done.
   */
  async replace<T>({
    kind,
    ownerId,
    file,
    previousKey,
    persist,
  }: ReplaceParams<T>): Promise<T> {
    const { extension, content } = validateUploadedFile(kind, file);
    const key = buildStorageKey(
      FILE_KINDS[kind].scope,
      ownerId,
      kind,
      extension,
    );

    await this.storage.save(key, content);
    const persisted = await persist(key);
    await this.deleteQuietly(previousKey, key);

    return persisted;
  }

  async remove<T>({ previousKey, persist }: RemoveParams<T>): Promise<T> {
    const persisted = await persist(null);
    await this.deleteQuietly(previousKey, null);

    return persisted;
  }

  async read(key: string | null): Promise<Buffer> {
    if (key === null || !isStorageKey(key)) {
      throw new NotFoundException('No file stored.');
    }

    const content = await this.storage.read(key);
    if (content === null) {
      throw new NotFoundException('No file stored.');
    }

    return content;
  }

  private async deleteQuietly(
    key: string | null,
    replacedBy: string | null,
  ): Promise<void> {
    if (key === null || key === replacedBy || !isStorageKey(key)) {
      return;
    }

    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.error(
        `Orphan file left behind: could not delete "${key}".`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
