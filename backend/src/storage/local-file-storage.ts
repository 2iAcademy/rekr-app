import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { FileStorage } from './file-storage.interface';
import { isStorageKey } from './storage-key';

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async save(key: string, content: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    // 0o640, not the 0o644 a default umask would give: on the VPS these are CVs,
    // and nothing outside the service account has a reason to read them.
    await writeFile(path, content, { mode: 0o640 });
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  /**
   * Two independent checks, on purpose.
   *
   * `isStorageKey` already rejects every traversal spelling, so the containment
   * test below should be unreachable. It stays because this is the one place in
   * the codebase where a string becomes a filesystem path: if a future caller
   * ever builds a key by hand, or the key grammar is loosened, the blast radius
   * of that mistake is an exception instead of an arbitrary file read.
   *
   * Comparing against `${root}${sep}` rather than `root` is what stops a sibling
   * directory whose name merely starts with the root — `/data/uploads-evil`
   * passes a bare `startsWith('/data/uploads')`.
   */
  private pathFor(key: string): string {
    if (!isStorageKey(key)) {
      throw new Error(`Refusing to touch the unsafe storage key "${key}".`);
    }

    const path = resolve(join(this.root, key));
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) {
      throw new Error(
        `The storage key "${key}" resolves outside the uploads root.`,
      );
    }

    return path;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
